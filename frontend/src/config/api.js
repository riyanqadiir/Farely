import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * API base URL for Farely backend.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL in .env (set for physical devices or fixed staging URLs)
 * 2. DEV_HOST_OVERRIDE below (quick local override)
 * 3. In __DEV__, host derived from Expo (same machine as Metro) → :3000
 * 4. Fallback: iOS simulator → localhost; Android emulator → 10.0.2.2
 *
 * Physical device: either rely on (3) when Metro reports your LAN IP, or set (1).
 */
const DEV_HOST_OVERRIDE = null; // e.g. 'http://192.168.1.10:3000'

const BACKEND_PORT = 3000;

function isLocalLoopbackUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch (_) {
    return /localhost|127\.0\.0\.1/.test(url);
  }
}

/** Strip host from values like "192.168.0.5:8081" or "10.0.2.2:8081". */
function hostFromDevServerUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const host = uri.split(':')[0]?.trim();
  return host || null;
}

/**
 * Expo injects the packager host during dev (often your LAN IP). Reuse it for the API port.
 * Dev launcher / Expo Go may expose this under different keys.
 */
function getExpoDevHostname() {
  const raw =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri;
  return hostFromDevServerUri(raw);
}

/** On Android emulator, "localhost" in the manifest means the emulator itself — map to host loopback. */
function resolveDevApiHost(hostname) {
  if (!hostname) return null;
  if (Platform.OS === 'android' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    return '10.0.2.2';
  }
  return hostname;
}

const getBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) {
    const normalized = fromEnv.replace(/\/$/, '');
    // In dev, localhost from .env breaks Android physical devices and often emulators.
    // Let auto host resolution handle those cases instead.
    if (!(__DEV__ && Platform.OS === 'android' && isLocalLoopbackUrl(normalized))) {
      return normalized;
    }
  }

  if (DEV_HOST_OVERRIDE) return DEV_HOST_OVERRIDE.replace(/\/$/, '');

  if (__DEV__) {
    const expoHost = resolveDevApiHost(getExpoDevHostname());
    if (expoHost) {
      return `http://${expoHost}:${BACKEND_PORT}`;
    }
    return Platform.select({
      ios: `http://localhost:${BACKEND_PORT}`,
      android: `http://10.0.2.2:${BACKEND_PORT}`,
      default: `http://localhost:${BACKEND_PORT}`,
    });
  }

  return 'https://your-production-api.com';
};

export const API_BASE_URL = getBaseUrl();
export const API_TIMEOUT = 15000;
