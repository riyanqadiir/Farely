/** Shared pickup/destination validation for compare + handoff APIs. */

export function hasValidRouteEndpoints(pickupCoords, destinationCoords) {
  return (
    pickupCoords
    && destinationCoords
    && typeof pickupCoords.latitude === 'number'
    && typeof pickupCoords.longitude === 'number'
    && typeof destinationCoords.latitude === 'number'
    && typeof destinationCoords.longitude === 'number'
    && Number.isFinite(pickupCoords.latitude)
    && Number.isFinite(pickupCoords.longitude)
    && Number.isFinite(destinationCoords.latitude)
    && Number.isFinite(destinationCoords.longitude)
    && !(pickupCoords.latitude === 0 && pickupCoords.longitude === 0)
    && !(destinationCoords.latitude === 0 && destinationCoords.longitude === 0)
  );
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
  return {
    searchLogId: searchLogId || undefined,
    pickup: String(pickup || '').trim(),
    destination: String(destination || '').trim(),
    pickupCoords: {
      latitude: pickupCoords.latitude,
      longitude: pickupCoords.longitude,
    },
    destinationCoords: {
      latitude: destinationCoords.latitude,
      longitude: destinationCoords.longitude,
    },
    pickupLat: pickupCoords.latitude,
    pickupLng: pickupCoords.longitude,
    destinationLat: destinationCoords.latitude,
    destinationLng: destinationCoords.longitude,
    rideType: rideType || 'car',
    carAc: rideType === 'car' ? Boolean(carAc) : false,
    ...extra,
  };
}
