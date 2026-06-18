/** Shared pickup/destination validation for compare + handoff APIs. */

export function coerceCoords(coords) {
  if (!coords || typeof coords !== 'object') return null;
  const latitude = typeof coords.latitude === 'number'
    ? coords.latitude
    : Number.parseFloat(coords.latitude);
  const longitude = typeof coords.longitude === 'number'
    ? coords.longitude
    : Number.parseFloat(coords.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function hasValidRouteEndpoints(pickupCoords, destinationCoords) {
  return Boolean(coerceCoords(pickupCoords) && coerceCoords(destinationCoords));
}

export function buildRouteHandoffBody({
  searchLogId,
  pickup,
  destination,
  pickupCoords,
  destinationCoords,
  rideType,
  carAc,
  extra = {},
}) {
  const pickupPoint = coerceCoords(pickupCoords);
  const destinationPoint = coerceCoords(destinationCoords);
  if (!pickupPoint || !destinationPoint) {
    return null;
  }

  return {
    searchLogId: searchLogId || undefined,
    pickup: String(pickup || '').trim(),
    destination: String(destination || '').trim(),
    pickupCoords: pickupPoint,
    destinationCoords: destinationPoint,
    pickupLat: pickupPoint.latitude,
    pickupLng: pickupPoint.longitude,
    destinationLat: destinationPoint.latitude,
    destinationLng: destinationPoint.longitude,
    rideType: rideType || 'car',
    carAc: rideType === 'car' ? Boolean(carAc) : false,
    ...extra,
  };
}
