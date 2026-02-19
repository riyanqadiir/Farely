/**
 * Country list with dial codes for phone input.
 * Built from libphonenumber-js supported countries; names for display.
 * Sorted by dial code then name for easier picking.
 */
import { getCountries, getCountryCallingCode } from 'libphonenumber-js/mobile';

const COUNTRY_NAMES = {
  AC: 'Ascension Island', AD: 'Andorra', AE: 'United Arab Emirates', AF: 'Afghanistan', AG: 'Antigua and Barbuda',
  AI: 'Anguilla', AL: 'Albania', AM: 'Armenia', AO: 'Angola', AR: 'Argentina', AS: 'American Samoa', AT: 'Austria',
  AU: 'Australia', AW: 'Aruba', AX: 'Åland Islands', AZ: 'Azerbaijan', BA: 'Bosnia and Herzegovina', BB: 'Barbados',
  BD: 'Bangladesh', BE: 'Belgium', BF: 'Burkina Faso', BG: 'Bulgaria', BH: 'Bahrain', BI: 'Burundi', BJ: 'Benin',
  BL: 'Saint Barthélemy', BM: 'Bermuda', BN: 'Brunei', BO: 'Bolivia', BQ: 'Caribbean Netherlands', BR: 'Brazil',
  BS: 'Bahamas', BT: 'Bhutan', BW: 'Botswana', BY: 'Belarus', BZ: 'Belize', CA: 'Canada', CC: 'Cocos Islands',
  CD: 'DR Congo', CF: 'Central African Republic', CG: 'Republic of the Congo', CH: 'Switzerland', CI: 'Ivory Coast',
  CK: 'Cook Islands', CL: 'Chile', CM: 'Cameroon', CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba',
  CV: 'Cape Verde', CW: 'Curaçao', CX: 'Christmas Island', CY: 'Cyprus', CZ: 'Czech Republic', DE: 'Germany',
  DJ: 'Djibouti', DK: 'Denmark', DM: 'Dominica', DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador',
  EE: 'Estonia', EG: 'Egypt', EH: 'Western Sahara', ER: 'Eritrea', ES: 'Spain', ET: 'Ethiopia', FI: 'Finland',
  FJ: 'Fiji', FK: 'Falkland Islands', FM: 'Micronesia', FO: 'Faroe Islands', FR: 'France', GA: 'Gabon', GB: 'United Kingdom',
  GD: 'Grenada', GE: 'Georgia', GF: 'French Guiana', GG: 'Guernsey', GH: 'Ghana', GI: 'Gibraltar', GL: 'Greenland',
  GM: 'Gambia', GN: 'Guinea', GP: 'Guadeloupe', GQ: 'Equatorial Guinea', GR: 'Greece', GT: 'Guatemala', GU: 'Guam',
  GW: 'Guinea-Bissau', GY: 'Guyana', HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatia', HT: 'Haiti', HU: 'Hungary',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IM: 'Isle of Man', IN: 'India', IO: 'British Indian Ocean Territory',
  IQ: 'Iraq', IR: 'Iran', IS: 'Iceland', IT: 'Italy', JE: 'Jersey', JM: 'Jamaica', JO: 'Jordan', JP: 'Japan',
  KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia', KI: 'Kiribati', KM: 'Comoros', KN: 'Saint Kitts and Nevis',
  KP: 'North Korea', KR: 'South Korea', KW: 'Kuwait', KY: 'Cayman Islands', KZ: 'Kazakhstan', LA: 'Laos',
  LB: 'Lebanon', LC: 'Saint Lucia', LI: 'Liechtenstein', LK: 'Sri Lanka', LR: 'Liberia', LS: 'Lesotho',
  LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia', LY: 'Libya', MA: 'Morocco', MC: 'Monaco', MD: 'Moldova',
  ME: 'Montenegro', MF: 'Saint Martin', MG: 'Madagascar', MH: 'Marshall Islands', MK: 'North Macedonia', ML: 'Mali',
  MM: 'Myanmar', MN: 'Mongolia', MO: 'Macau', MP: 'Northern Mariana Islands', MQ: 'Martinique', MR: 'Mauritania',
  MS: 'Montserrat', MT: 'Malta', MU: 'Mauritius', MV: 'Maldives', MW: 'Malawi', MX: 'Mexico', MY: 'Malaysia',
  MZ: 'Mozambique', NA: 'Namibia', NC: 'New Caledonia', NE: 'Niger', NF: 'Norfolk Island', NG: 'Nigeria',
  NI: 'Nicaragua', NL: 'Netherlands', NO: 'Norway', NP: 'Nepal', NR: 'Nauru', NU: 'Niue', NZ: 'New Zealand',
  OM: 'Oman', PA: 'Panama', PE: 'Peru', PF: 'French Polynesia', PG: 'Papua New Guinea', PH: 'Philippines',
  PK: 'Pakistan', PL: 'Poland', PM: 'Saint Pierre and Miquelon', PR: 'Puerto Rico', PS: 'Palestine', PT: 'Portugal',
  PW: 'Palau', PY: 'Paraguay', QA: 'Qatar', RE: 'Réunion', RO: 'Romania', RS: 'Serbia', RU: 'Russia', RW: 'Rwanda',
  SA: 'Saudi Arabia', SB: 'Solomon Islands', SC: 'Seychelles', SD: 'Sudan', SE: 'Sweden', SG: 'Singapore',
  SH: 'Saint Helena', SI: 'Slovenia', SJ: 'Svalbard and Jan Mayen', SK: 'Slovakia', SL: 'Sierra Leone', SM: 'San Marino',
  SN: 'Senegal', SO: 'Somalia', SR: 'Suriname', SS: 'South Sudan', ST: 'São Tomé and Príncipe', SV: 'El Salvador',
  SX: 'Sint Maarten', SY: 'Syria', SZ: 'Eswatini', TC: 'Turks and Caicos Islands', TD: 'Chad', TG: 'Togo',
  TH: 'Thailand', TJ: 'Tajikistan', TK: 'Tokelau', TL: 'Timor-Leste', TM: 'Turkmenistan', TN: 'Tunisia', TO: 'Tonga',
  TR: 'Turkey', TT: 'Trinidad and Tobago', TV: 'Tuvalu', TW: 'Taiwan', TZ: 'Tanzania', UA: 'Ukraine', UG: 'Uganda',
  US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan', VA: 'Vatican City', VC: 'Saint Vincent and the Grenadines',
  VE: 'Venezuela', VG: 'British Virgin Islands', VI: 'U.S. Virgin Islands', VN: 'Vietnam', VU: 'Vanuatu',
  WF: 'Wallis and Futuna', WS: 'Samoa', XK: 'Kosovo', YE: 'Yemen', ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe',
};

function buildCountryList() {
  const list = [];
  try {
    const codes = getCountries();
    for (const code of codes) {
      const dialCode = getCountryCallingCode(code);
      const name = COUNTRY_NAMES[code] || code;
      list.push({ code, dialCode: '+' + dialCode, name });
    }
  } catch (_) {
    // Fallback minimal list if libphonenumber-js fails
    list.push(
      { code: 'PK', dialCode: '+92', name: 'Pakistan' },
      { code: 'US', dialCode: '+1', name: 'United States' },
      { code: 'GB', dialCode: '+44', name: 'United Kingdom' },
      { code: 'IN', dialCode: '+91', name: 'India' },
      { code: 'AE', dialCode: '+971', name: 'United Arab Emirates' },
      { code: 'SA', dialCode: '+966', name: 'Saudi Arabia' },
    );
  }
  return list.sort((a, b) => {
    const dialA = parseInt(a.dialCode.replace(/\D/g, ''), 10);
    const dialB = parseInt(b.dialCode.replace(/\D/g, ''), 10);
    if (dialA !== dialB) return dialA - dialB;
    return (a.name || '').localeCompare(b.name || '');
  });
}

export const COUNTRIES = buildCountryList();

export function getDefaultCountry() {
  return COUNTRIES.find((c) => c.code === 'PK') || COUNTRIES[0];
}
