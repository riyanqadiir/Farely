/**
 * Brand / tab images live under frontend/assets/images/
 * Replace the placeholder PNGs with your real logos (same filenames).
 *
 * Provider files: assets/images/providers/{uber|yango|careem|indrive}.png
 * Tab bar icons: Font Awesome 6 via @expo/vector-icons (see App.js).
 */

/* eslint-disable global-require */

export const PROVIDER_LOGOS = {
  uber: require('../../assets/images/providers/uber.png'),
  yango: require('../../assets/images/providers/yango.png'),
  careem: require('../../assets/images/providers/careem.png'),
  indrive: require('../../assets/images/providers/indrive.png'),
};

/**
 * @param {string} [providerName] e.g. "Uber", "Yango", "Careem", "inDrive"
 * @returns {number | null} React Native image module id
 */
export function getProviderLogo(providerName) {
  if (!providerName || typeof providerName !== 'string') return null;
  const key = providerName.trim().toLowerCase().replace(/[\s-]+/g, '');
  if (key === 'uber') return PROVIDER_LOGOS.uber;
  if (key === 'yango') return PROVIDER_LOGOS.yango;
  if (key === 'careem') return PROVIDER_LOGOS.careem;
  if (key === 'indrive') return PROVIDER_LOGOS.indrive;
  return null;
}
