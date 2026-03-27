import { Platform } from 'react-native';

/**
 * API base URL for Farely backend.
 * - Emulator: use null (android=10.0.2.2, ios=localhost)
 * - Physical device: set to your machine IP, e.g. 'http://192.168.10.15:3000'
 *   Get IP: Mac: ifconfig | grep "inet " | grep -v 127.0.0.1
 */
const DEV_OVERRIDE = null; // null = emulator (10.0.2.2); set Mac IP for physical device

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
