/**
 * Read `user.id` from a JWT payload without verifying the signature
 * (used only to attribute local notifications before the token is removed).
 */
export function decodeJwtUserId(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const atobFn = typeof globalThis.atob === 'function' ? globalThis.atob.bind(globalThis) : null;
    if (!atobFn) return null;
    const raw = atobFn(base64);
    const payload = JSON.parse(raw);
    if (payload?.user?.id == null) return null;
    return String(payload.user.id);
  } catch (_) {
    return null;
  }
}
