/**
 * Brand / tab images live under frontend/assets/images/
 * Replace the placeholder PNGs with your real logos (same filenames).
 *
 * Provider files: assets/images/providers/{yango|bykea}.png
 * Tab bar icons: Font Awesome 6 via @expo/vector-icons (see App.js).
 */

/* eslint-disable global-require */

export const PROVIDER_LOGOS = {
  yango: require('../../assets/images/providers/yango.png'),
  bykea: require('../../assets/images/providers/bykea.png'),
};

function providerLogoKey(providerName) {
  if (!providerName || typeof providerName !== 'string') return '';
  return providerName.trim().toLowerCase().replace(/[\s-]+/g, '');
}

/**
 * @param {string} [providerName] e.g. "Yango", "Bykea"
 * @returns {number | null} React Native image module id
 */
export function getProviderLogo(providerName) {
  const key = providerLogoKey(providerName);
  return PROVIDER_LOGOS[key] ?? null;
}
