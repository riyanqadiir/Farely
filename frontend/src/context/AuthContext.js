import React, { createContext, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/auth';
import { setSessionInvalidationHandler } from '../api/farelyApi';
import { recordAccountModerationEvent, maybeNotifyAccessRestored } from '../utils/notifications';

export const AuthContext = createContext();

/** @deprecated Legacy single-key flag; prefer per-user keys. */
const LEGACY_PROFILE_ONBOARDED_KEY = 'profileOnboarded';

function userIdFromUser(u) {
  if (!u) return null;
  const id = u.id ?? u._id;
  return id != null ? String(id) : null;
}

function profileOnboardedKeyForUser(userId) {
  return userId ? `profileOnboarded:${userId}` : LEGACY_PROFILE_ONBOARDED_KEY;
}

/** Whether this account has finished the one-time profile step (device-local). */
async function readProfileOnboardedFlag(user) {
  const uid = userIdFromUser(user);
  if (!uid) return false;
  const keyed = await AsyncStorage.getItem(profileOnboardedKeyForUser(uid));
  if (keyed === 'true') return true;
  const legacy = await AsyncStorage.getItem(LEGACY_PROFILE_ONBOARDED_KEY);
  if (legacy === 'true') {
    await AsyncStorage.setItem(profileOnboardedKeyForUser(uid), 'true');
    await AsyncStorage.removeItem(LEGACY_PROFILE_ONBOARDED_KEY);
    return true;
  }
  return false;
}

/**
 * Normalize a backend block/delete response payload to the shape the
 * AccountBlockedScreen consumes.
 */
function buildBlockState(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.kind === 'deleted') return { kind: 'deleted' };
  return {
    kind: 'blocked',
    reason: payload.reason ?? null,
    blockedUntil: payload.blockedUntil ?? null,
    blockedAt: payload.blockedAt ?? null,
    message: payload.message ?? null,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingProfileComplete, setPendingProfileCompleteState] = useState(false);
  /**
   * When non-null the UI swaps to the `AccountBlocked` screen instead of
   * the normal auth stack. Set either by the axios interceptor (after an
   * already-authenticated request gets blocked) or by `login` when the
   * very first auth call comes back 403/401.
   */
  const [sessionInvalidation, setSessionInvalidation] = useState(null);

  const clearSessionState = useCallback(async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('pendingProfileComplete');
    setUser(null);
    setPendingProfileCompleteState(false);
  }, []);

  /** Centralized: any blocked/deleted detection routes through this. */
  const handleSessionInvalidation = useCallback(
    async (payload) => {
      await recordAccountModerationEvent(payload);
      await clearSessionState();
      const next = buildBlockState(payload);
      if (next) setSessionInvalidation(next);
    },
    [clearSessionState]
  );

  const loadUser = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      setUser(null);
      setPendingProfileCompleteState(false);
      setLoading(false);
      return;
    }
    try {
      const res = await authApi.getMe();
      const u = res.data?.user ?? res.data;
      setUser(u);
      const onboarded = await readProfileOnboardedFlag(u);
      setPendingProfileCompleteState(!onboarded);
      await maybeNotifyAccessRestored(u);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data || {};
      const code = data.code || '';
      const handledByInterceptor =
        (status === 403 && code === 'ACCOUNT_BLOCKED') ||
        (status === 401 && code === 'USER_NOT_FOUND');
      if (!handledByInterceptor) {
        setUser(null);
        setPendingProfileCompleteState(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Register axios handler before paint so the first `getMe` always updates UI on block/delete.
  useLayoutEffect(() => {
    setSessionInvalidationHandler((payload) => handleSessionInvalidation(payload));
    return () => setSessionInvalidationHandler(null);
  }, [handleSessionInvalidation]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  /**
   * Mark the one-time profile step complete for this account (device-local).
   * Pass `userId` string after signup save so we do not rely on a stale `user` ref.
   */
  const markProfileOnboardingDone = async (userOrId) => {
    let uid = null;
    if (typeof userOrId === 'string' && userOrId) uid = userOrId;
    else if (userOrId && typeof userOrId === 'object') uid = userIdFromUser(userOrId);
    else uid = userIdFromUser(user);
    if (uid) {
      await AsyncStorage.setItem(profileOnboardedKeyForUser(uid), 'true');
      await AsyncStorage.removeItem(LEGACY_PROFILE_ONBOARDED_KEY);
    }
    setPendingProfileCompleteState(false);
  };

  const setPendingProfileComplete = (value) => {
    setPendingProfileCompleteState(!!value);
  };

  const login = async (loginId, password) => {
    try {
      const res = await authApi.login({ loginId, password });
      await AsyncStorage.setItem('token', res.data.token);
      // Clear any prior block screen since a successful login means
      // the account is healthy again (e.g., temporary block expired).
      setSessionInvalidation(null);
      await loadUser();
      return { success: true };
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data || {};
      if (status === 403 && data.code === 'ACCOUNT_BLOCKED') {
        return { success: false, blocked: true, msg: data.message || 'Account blocked.' };
      }
      if (status === 401 && data.code === 'USER_NOT_FOUND') {
        return { success: false, deleted: true, msg: data.message || 'Account no longer exists.' };
      }
      if (status === 401 && data.code === 'PASSWORD_NOT_SET') {
        return {
          success: false,
          passwordNotSet: true,
          msg:
            data.message ||
            'No password set yet. Use Forgot password to verify your email or phone and create one.',
        };
      }
      if (status === 400 && Array.isArray(data.errors) && data.errors.length > 0) {
        const first = data.errors[0];
        const vmsg = typeof first?.message === 'string' ? first.message : null;
        return { success: false, msg: vmsg || data.message || 'Login failed' };
      }
      const serverMsg = typeof data.message === 'string' ? data.message : null;
      return {
        success: false,
        msg: serverMsg || err.message || 'Login failed',
      };
    }
  };

  /** Multi-step signup: use authApi.signup, authApi.verifyOtp, authApi.setPassword separately.
   *  This stub is for backward compatibility until SignupScreen is updated. */
  const signup = async () => {
    return { success: false, msg: 'Use new signup flow (OTP → Set Password)' };
  };

  const logout = useCallback(async () => {
    await clearSessionState();
    setSessionInvalidation(null);
  }, [clearSessionState]);

  /** Clears the block/deleted screen so the user lands on Welcome again. */
  const dismissSessionInvalidation = useCallback(() => {
    setSessionInvalidation(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        loadUser,
        authApi,
        pendingProfileComplete,
        setPendingProfileComplete,
        markProfileOnboardingDone,
        sessionInvalidation,
        dismissSessionInvalidation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
