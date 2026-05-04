/**
 * Yango is modeled cheaper than Bykea. If stored scrapes or rounding collapse both to the same PKR,
 * bump Bykea so the compare screen never shows identical prices for the two brands.
 *
 * Never inflates Bykea from a Yango *live* scrape when Bykea is still an estimate — that looked like
 * "Bykea changed without opening the app." Never overwrites a live-captured Bykea fare.
 */
const MIN_BYKEA_VS_YANGO_RATIO = 1.15;

function normProvider(p) {
  const v = String(p || '')
    .trim()
    .toLowerCase();
  if (v.includes('yango') || v.includes('yandex')) return 'Yango';
  if (v.includes('bykea') || v.includes('bykia')) return 'Bykea';
  return '';
}

/**
 * @param {Array<{ provider?: string, fare?: number, fareSource?: string }>} items
 * @returns {Array} shallow-cloned rows with Bykea.fare raised when needed
 */
export function applyYangoBykeaMinSpread(items) {
  const list = Array.isArray(items) ? items.map((x) => ({ ...x })) : [];
  let yi = -1;
  let bi = -1;
  for (let i = 0; i < list.length; i++) {
    const n = normProvider(list[i]?.provider);
    if (n === 'Yango') yi = i;
    if (n === 'Bykea') bi = i;
  }
  if (yi < 0 || bi < 0) return list;
  const yRow = list[yi];
  const bRow = list[bi];
  if (bRow.fareSource === 'live_capture') return list;
  if (yRow.fareSource === 'live_capture' && bRow.fareSource !== 'live_capture') return list;
  const yf = Number(yRow.fare);
  const bf = Number(bRow.fare);
  if (!Number.isFinite(yf) || !Number.isFinite(bf)) return list;
  const minBykea = Math.round(yf * MIN_BYKEA_VS_YANGO_RATIO);
  if (bf >= minBykea) return list;
  list[bi] = { ...list[bi], fare: minBykea };
  return list;
}
