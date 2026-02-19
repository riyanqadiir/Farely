import { Platform } from 'react-native';

/**
 * API base URL for Farely backend.
 * - iOS simulator: localhost works
 * - Android emulator: 10.0.2.2 = host machine
 * - Physical device: use your machine's local IP (e.g. http://192.168.1.5:3000)
 */
const DEV_OVERRIDE = null; // Set to 'http://192.168.1.x:3000' for physical device testing

const getBaseUrl = () => {
  if (DEV_OVERRIDE) return DEV_OVERRIDE;
  if (__DEV__) {
    return Platform.select({
      ios: 'http://localhost:3000',
      android: 'http://10.0.2.2:3000',
      default: 'http://localhost:3000',
    });
  }
  return 'https://your-production-api.com'; // Replace with production URL
};

export const API_BASE_URL = getBaseUrl();
export const API_TIMEOUT = 15000;
