import farelyApi from '../api/farelyApi';
import { patchPendingRideConfirmation } from './rideConfirmation';
import {
  buildCaptureStorageKey,
  getCapturedFaresForContext,
  saveCapturedFare,
} from './liveFareStore';
import { consumeBufferedUiCapture } from '../native/accessibilityBridge';

/**
 * PATCH live provider fare onto the active ride handoff (admin + audit).
 * @returns {Promise<boolean>} true when the server accepted the update
 */
export async function patchHandoffCapture(handoffId, capturedFare, capturedProvider) {
  if (!handoffId) return false;
  const fare = Math.round(Number(capturedFare));
  if (!Number.isFinite(fare) || fare <= 0) return false;
  const provider = String(capturedProvider || '').trim();
  try {
    await farelyApi.patch(`/rides/ride-handoff/${handoffId}/capture`, {
      capturedFare: fare,
      capturedProvider: provider || undefined,
    });
    void patchPendingRideConfirmation(handoffId, {
      capturedFare: fare,
      capturedProvider: provider || undefined,
    });
    return true;
  } catch (err) {
    if (__DEV__) {
      console.warn('[handoffCaptureSync] PATCH capture failed:', err?.message || err);
    }
    return false;
  }
}

/**
 * Flush the latest saved scrape for this route onto the handoff (e.g. after return from provider).
 */
export async function flushStoredCaptureToHandoff(
  handoffId,
  pickupCoords,
  destinationCoords,
  rideType,
  carAc,
  preferredProvider
) {
  if (!handoffId || !pickupCoords || !destinationCoords) return false;
  const captures = await getCapturedFaresForContext(
    pickupCoords,
    destinationCoords,
    rideType,
    carAc
  );
  if (!captures.length) return false;

  const pref = String(preferredProvider || '').trim().toLowerCase();
  let pick = captures[0];
  if (pref) {
    const match = captures.find(
      (c) => String(c?.provider || '').trim().toLowerCase() === pref
    );
    if (match) pick = match;
  }

  const fare = typeof pick?.fare === 'number' ? pick.fare : Number(pick?.fare);
  if (!Number.isFinite(fare) || fare <= 0) return false;
  return patchHandoffCapture(handoffId, fare, pick.provider);
}

function coordsFromPending(pending) {
  const pk = pending?.pickupCoords;
  const dest = pending?.destinationCoords;
  if (
    pk
    && dest
    && typeof pk.latitude === 'number'
    && typeof pk.longitude === 'number'
    && typeof dest.latitude === 'number'
    && typeof dest.longitude === 'number'
  ) {
    return { pickupCoords: pk, destinationCoords: dest };
  }
  return null;
}

/**
 * Push latest AsyncStorage scrape to API for a pending handoff (e.g. after return from provider).
 * @returns {{ capturedFare?: number, capturedProvider?: string } | null}
 */
export async function syncCaptureForPendingHandoff(pending) {
  if (!pending?.handoffId) return null;
  const coords = coordsFromPending(pending);
  if (!coords) return null;

  // Pull any buffered native scrape into AsyncStorage before reading captures below.
  // We import only the raw native bridge here (not liveCapturePipeline) so this file
  // stays upstream of the pipeline in the dependency graph and avoids a require cycle.
  const buffered = await consumeBufferedUiCapture();
  if (buffered?.provider && Number.isFinite(buffered.fare) && buffered.fare > 0) {
    const key = buildCaptureStorageKey(
      coords.pickupCoords,
      coords.destinationCoords,
      pending.rideType || 'car',
      Boolean(pending.carAc)
    );
    if (key) {
      await saveCapturedFare(key, buffered.provider, buffered.fare, buffered.rawText || '');
    }
  }

  const ok = await flushStoredCaptureToHandoff(
    pending.handoffId,
    coords.pickupCoords,
    coords.destinationCoords,
    pending.rideType || 'car',
    Boolean(pending.carAc),
    pending.provider || pending.capturedProvider
  );
  if (!ok) return null;

  const captures = await getCapturedFaresForContext(
    coords.pickupCoords,
    coords.destinationCoords,
    pending.rideType || 'car',
    Boolean(pending.carAc)
  );
  const pref = String(pending.provider || pending.capturedProvider || '').trim().toLowerCase();
  let pick = captures[0];
  if (pref) {
    const match = captures.find(
      (c) => String(c?.provider || '').trim().toLowerCase() === pref
    );
    if (match) pick = match;
  }
  const fare = typeof pick?.fare === 'number' ? pick.fare : Number(pick?.fare);
  if (!Number.isFinite(fare) || fare <= 0) return null;
  return {
    capturedFare: Math.round(fare),
    capturedProvider: pick.provider || pending.provider,
  };
}
