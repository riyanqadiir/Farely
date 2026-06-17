/**
 * Device-side cache + helpers for the live-traffic surge feature.
 *
 *  1. `getHotspotItems(force)` — single source of truth for the hotspot
 *     list. Cached in memory with a 5-minute TTL (same TTL the backend
 *     uses for its Distance Matrix cache, so we never hit the network
 *     more often than the server is willing to refresh anyway).
 *  2. `pickSurgeZone(pickup, items)` — find the closest watch-zone within
 *     2 km of the rider's pickup and return its surge tier.
 *  3. `applySurgeToFare(baseFare, surge)` — small helper so screens can't
 *     accidentally apply the multiplier twice or forget to round.
 */
import { hotspotsApi } from '../api/hotspots';

const CACHE_TTL_MS = 5 * 60 * 1000;
const PICKUP_MATCH_RADIUS_KM = 2.0;

const NEUTRAL_SURGE = Object.freeze({
  surgeMultiplier: 1.0,
  surgeLevel: 'normal',
  surgePercent: 0,
  zoneName: null,
  zoneCity: null,
  zoneKey: null,
  distanceKm: null,
});

let cache = null;

function nowMs() {
  return Date.now();
}

function distKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((v) => Number.isFinite(v))) return Infinity;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Fetch the live hotspot list (cached). On any network/config error we
 * return `[]` rather than throwing — surge is a nice-to-have and must
 * never block a booking flow.
 */
export async function getHotspotItems(force = false) {
  if (!force && cache && cache.expiresAt > nowMs()) {
    return cache.items;
  }
  try {
    const data = await hotspotsApi.list();
    const items = Array.isArray(data?.items) ? data.items : [];
    cache = { items, expiresAt: nowMs() + CACHE_TTL_MS };
    return items;
  } catch (_) {
    cache = { items: [], expiresAt: nowMs() + 60 * 1000 };
    return [];
  }
}

/**
 * Pick the closest available watch-zone within `maxKm` (default 2 km) of
 * the rider's pickup. Returns a normalized surge descriptor — always
 * with the same shape so callers can write surge-aware UI unconditionally.
 *
 * No zone found → neutral 1.0× surge (no fare adjustment, no chip).
 */
export function pickSurgeZone(pickupLat, pickupLng, items, maxKm = PICKUP_MATCH_RADIUS_KM) {
  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) return NEUTRAL_SURGE;
  const list = Array.isArray(items) ? items : [];
  let best = null;
  let bestDist = Infinity;
  for (const it of list) {
    if (!it || it.available === false) continue;
    const d = distKm(pickupLat, pickupLng, Number(it.lat), Number(it.lng));
    if (d < bestDist && d <= maxKm) {
      bestDist = d;
      best = it;
    }
  }
  if (!best) return NEUTRAL_SURGE;
  return {
    surgeMultiplier: Number(best.surgeMultiplier) || 1.0,
    surgeLevel: best.surgeLevel || 'normal',
    surgePercent: Number(best.surgePercent) || 0,
    zoneName: best.name || null,
    zoneCity: best.city || null,
    zoneKey: best.key || null,
    distanceKm: Number.isFinite(bestDist) ? Number(bestDist.toFixed(2)) : null,
  };
}

/**
 * Multiply a base fare by the active surge multiplier and round to the
 * nearest whole rupee. Safe to call with any surge descriptor — when
 * `surge` is missing or normal it's a no-op.
 */
export function applySurgeToFare(baseFare, surge) {
  const mult = surge?.surgeMultiplier;
  if (!Number.isFinite(baseFare)) return baseFare;
  if (!Number.isFinite(mult) || mult <= 1) return Math.round(baseFare);
  return Math.round(baseFare * mult);
}

export function clearSurgeCache() {
  cache = null;
}

/**
 * Shared pill colors for traffic surge (high / medium / low). Normal → null (no chip).
 */
export function getSurgeChipPalette(level) {
  switch (String(level || '').toLowerCase()) {
    case 'high':
      return { bg: 'rgba(220, 38, 38, 0.14)', fg: '#dc2626', border: 'rgba(220, 38, 38, 0.35)' };
    case 'medium':
      return { bg: 'rgba(217, 119, 6, 0.14)', fg: '#d97706', border: 'rgba(217, 119, 6, 0.35)' };
    case 'low':
      return { bg: 'rgba(5, 150, 105, 0.12)', fg: '#059669', border: 'rgba(5, 150, 105, 0.32)' };
    default:
      return null;
  }
}

/** Pickup coords from params often use `latitude` / `longitude`. */
export function coordsToLatLng(coords) {
  if (!coords || typeof coords !== 'object') return { lat: NaN, lng: NaN };
  const lat = Number(coords.latitude ?? coords.lat);
  const lng = Number(coords.longitude ?? coords.lng);
  return { lat, lng };
}

export { NEUTRAL_SURGE };
