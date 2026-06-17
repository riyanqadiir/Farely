import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT } from '../config/api';
import { decodeJwtUserId } from '../utils/jwtUserId';

const farelyApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

farelyApi.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

/**
 * Single dispatcher subscribed to by `AuthContext`. The interceptor below
 * does not import AuthContext directly (that would create a cycle and
 * also can't reach React state from outside the tree).
 *
 * Payload shape:
 *   { kind: 'blocked' | 'deleted', userId?, reason?, blockedUntil?, blockedAt?, message? }
 */
let sessionInvalidationHandler = null;

export function setSessionInvalidationHandler(fn) {
  sessionInvalidationHandler = typeof fn === 'function' ? fn : null;
}

farelyApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const body = err.response?.data || {};
    const code = body?.code || '';

    if (status === 403 && code === 'ACCOUNT_BLOCKED') {
      const token = await AsyncStorage.getItem('token');
      const userId = body?.userId || decodeJwtUserId(token);
      await AsyncStorage.removeItem('token');
      const fn = sessionInvalidationHandler;
      if (fn)
        await Promise.resolve(
          fn({
            kind: 'blocked',
            userId,
            reason: body?.reason ?? null,
            blockedUntil: body?.blockedUntil ?? null,
            blockedAt: body?.blockedAt ?? null,
            message: body?.message ?? null,
          })
        );
    } else if (status === 401 && code === 'USER_NOT_FOUND') {
      const token = await AsyncStorage.getItem('token');
      const userId = body?.userId || decodeJwtUserId(token);
      await AsyncStorage.removeItem('token');
      const fn = sessionInvalidationHandler;
      if (fn) await Promise.resolve(fn({ kind: 'deleted', userId }));
    } else if (status === 401) {
      // A failed email/password login returns 401; do not wipe an existing Bearer token
      // (e.g. user with a Google session opened the login screen and tried password).
      const method = String(err.config?.method || '').toLowerCase();
      const url = String(err.config?.url || '');
      const isLoginAttempt = method === 'post' && url.includes('auth/login');
      if (!isLoginAttempt) {
        await AsyncStorage.removeItem('token');
      }
    }
    return Promise.reject(err);
  }
);

export default farelyApi;
