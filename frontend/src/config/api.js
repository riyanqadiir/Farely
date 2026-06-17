import { Platform } from 'react-native';

/** Used when `EXPO_PUBLIC_API_URL` is unset and this is a release build (`__DEV__` false). */
const PRODUCTION_API_URL = 'https://farely-production.up.railway.app';

/**
 * API base URL for Farely backend.
 *
 * 1) Set `EXPO_PUBLIC_API_URL` in `frontend/.env` (Expo loads it at build time).
 *    - Local Metro + Android emulator: `http://localhost:3000` works; we rewrite to 10.0.2.2 on Android.
 *    - Physical device: use your Mac/LAN IP, e.g. `http://192.168.1.20:3000`
 *    - To hit Railway while debugging: set this to your `https://...railway.app` URL
 *
 * 2) If unset in dev: iOS → localhost:3000, Android emulator → 10.0.2.2:3000
 *
 * Important: A hardcoded production URL here used to ignore `.env` and breaks admin-block testing
 * when your backend + Mongo are local or a different deploy than production.
 */
function normalizeDevAndroidLocalhost(url) {
  if (!url || !__DEV__ || Platform.OS !== 'android') return url;
  return url.replace(/localhost/gi, '10.0.2.2').replace(/127\.0\.0\.1/g, '10.0.2.2');
}

const getBaseUrl = () => {
  const fromEnv = typeof process.env.EXPO_PUBLIC_API_URL === 'string'
    ? process.env.EXPO_PUBLIC_API_URL.trim()
    : '';
  if (fromEnv) {
    return normalizeDevAndroidLocalhost(fromEnv);
  }
  if (__DEV__) {
    return Platform.select({
      ios: 'http://localhost:3000',
      android: 'http://10.0.2.2:3000',
      default: 'http://localhost:3000',
    });
  }
  return PRODUCTION_API_URL;
};

export const API_BASE_URL = getBaseUrl();
export const API_TIMEOUT = 15000;
