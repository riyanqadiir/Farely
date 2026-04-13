import { Linking } from 'react-native';

/**
 * Strip formatting so the system dialer gets a clean E.164-style value when possible.
 */
export function normalizePhoneForDialer(input) {
  if (input == null) return '';
  const s = String(input).trim();
  if (!s) return '';
  const plus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  return plus ? `+${digits}` : digits;
}

/**
 * Opens the device phone app with the number (ACTION_DIAL / tel:). Does not place a call without user action.
 */
export async function openPhoneDialer(rawPhone) {
  const normalized = normalizePhoneForDialer(rawPhone);
  if (!normalized) return { ok: false, reason: 'empty' };
  const url = `tel:${normalized}`;
  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
