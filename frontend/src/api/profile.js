/**
 * Profile API – matches backend profile routes.
 * Photo upload uses fetch (not axios) to avoid FormData issues on Android.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import farelyApi from './farelyApi';

export const profileApi = {
  getProfile: () => farelyApi.get('/profile'),
  updateProfile: (body) => farelyApi.put('/profile', body),

  uploadPhoto: async (formData) => {
    const token = await AsyncStorage.getItem('token');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s for uploads
    try {
      const res = await fetch(`${API_BASE_URL}/profile/photo`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // Do NOT set Content-Type – fetch sets multipart boundary automatically
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || res.statusText || 'Upload failed');
        err.response = { status: res.status, data };
        throw err;
      }
      return { data };
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        const err = new Error('Upload timed out. Try a smaller image.');
        err.response = {};
        throw err;
      }
      const err = new Error(e.message || 'Network request failed');
      err.response = e.response;
      throw err;
    }
  },
};
