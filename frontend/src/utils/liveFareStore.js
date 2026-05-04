import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'live_fare_capture_v1';

function routeKey(pickupCoords, destinationCoords) {
  if (!pickupCoords || !destinationCoords) return '';
  const pLat = Number(pickupCoords.latitude || 0).toFixed(4);
  const pLng = Number(pickupCoords.longitude || 0).toFixed(4);
  const dLat = Number(destinationCoords.latitude || 0).toFixed(4);
  const dLng = Number(destinationCoords.longitude || 0).toFixed(4);
  return `${pLat},${pLng}|${dLat},${dLng}`;
}

export function buildRouteFareKey(pickupCoords, destinationCoords) {
  return routeKey(pickupCoords, destinationCoords);
}

/**
 * AsyncStorage bucket for scraped fares: same route + ride handoff (bike/rickshaw/car + car AC).
 * Changing ride type on the home map reads a different bucket without re-opening provider apps.
 */
export function buildCaptureStorageKey(pickupCoords, destinationCoords, rideType = 'car', carAc = false) {
  const base = routeKey(pickupCoords, destinationCoords);
  if (!base) return '';
  const rt = String(rideType || 'car').trim().toLowerCase();
  const ac = rt === 'car' && Boolean(carAc) ? '1' : '0';
  return `${base}|rt:${rt}|ac:${ac}`;
}

export async function saveCapturedFare(storageKey, provider, fare, rawText = '') {
  if (!storageKey || !provider || !Number.isFinite(fare) || fare <= 0) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const existing = parsed[storageKey] || {};
    parsed[storageKey] = {
      ...existing,
      [provider.toLowerCase()]: {
        provider,
        fare,
        rawText,
        capturedAt: Date.now(),
      },
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(parsed));
  } catch (_) {}
}

export async function getCapturedFares(storageKey) {
  if (!storageKey) return [];
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return Object.values(parsed[storageKey] || {});
  } catch (_) {
    return [];
  }
}

/** Prefer composite key (route + ride type); fall back to legacy route-only buckets from older builds. */
export async function getCapturedFaresForContext(pickupCoords, destinationCoords, rideType, carAc) {
  if (!pickupCoords || !destinationCoords) return [];
  const composite = buildCaptureStorageKey(pickupCoords, destinationCoords, rideType, carAc);
  const scoped = await getCapturedFares(composite);
  if (scoped.length) return scoped;
  const legacy = buildRouteFareKey(pickupCoords, destinationCoords);
  return getCapturedFares(legacy);
}
