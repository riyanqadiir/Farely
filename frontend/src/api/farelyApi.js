import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT } from '../config/api';

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

farelyApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      AsyncStorage.removeItem('token');
    }
    return Promise.reject(err);
  }
);

export default farelyApi;
