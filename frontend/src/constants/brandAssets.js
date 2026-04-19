/**
 * Brand / tab images live under frontend/assets/images/
 * Replace the placeholder PNGs with your real logos (same filenames).
 *
 * Provider files: assets/images/providers/{uber|yango|careem|indrive|bykea}.png
 * Tab bar icons: Font Awesome 6 via @expo/vector-icons (see App.js).
 */

/* eslint-disable global-require */

export const PROVIDER_LOGOS = {
  uber: require('../../assets/images/providers/uber.png'),
  yango: require('../../assets/images/providers/yango.png'),
  careem: require('../../assets/images/providers/careem.png'),
  indrive: require('../../assets/images/providers/indrive.png'),
  bykea: require('../../assets/images/providers/bykea.png'),
};

function providerLogoKey(providerName) {
  if (!providerName || typeof providerName !== 'string') return '';
  return providerName.trim().toLowerCase().replace(/[\s-]+/g, '');
}

/**
 * @param {string} [providerName] e.g. "Uber", "Yango", "Careem", "inDrive", "Bykea"
 * @returns {number | null} React Native image module id
 */
export function getProviderLogo(providerName) {
  const key = providerLogoKey(providerName);
  return PROVIDER_LOGOS[key] ?? null;
}
