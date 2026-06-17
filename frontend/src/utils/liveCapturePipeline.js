import { buildCaptureStorageKey, saveCapturedFare } from './liveFareStore';
import { patchHandoffCapture } from './handoffCaptureSync';
import { getActiveCaptureHandoff } from './activeCaptureHandoff';
import { getPendingRideConfirmation } from './rideConfirmation';
import { consumeBufferedUiCapture } from '../native/accessibilityBridge';

const normalizeProvider = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('yango') || v.includes('yandex')) return 'Yango';
  if (v.includes('bykea') || v.includes('bykia')) return 'Bykea';
  return String(value || '').trim();
};

export const isPakistanLiveCaptureProvider = (name) => {
  const p = normalizeProvider(name).toLowerCase();
  return p === 'yango' || p === 'bykea';
};

export function parseUiDataCapture(data) {
  const provider = normalizeProvider(data?.provider);
  const fare = typeof data?.fare === 'number' ? data.fare : Number(data?.fare);
  const rawText = typeof data?.rawText === 'string' ? data.rawText.trim() : '';
  if (!provider || !isPakistanLiveCaptureProvider(provider) || !Number.isFinite(fare) || fare <= 0) {
    return null;
  }
  return { provider, fare, rawText };
}

/**
 * Persist scrape + PATCH handoff using active/pending route context (works when RideOptions unmounted).
 */
export async function applyLiveCaptureEvent(capture) {
  const parsed = typeof capture?.provider === 'string' ? capture : parseUiDataCapture(capture);
  if (!parsed) return false;

  const active = await getActiveCaptureHandoff();
  const pending = await getPendingRideConfirmation();
  const ctx =
    active?.handoffId && active?.pickupCoords && active?.destinationCoords
      ? active
      : pending?.handoffId && pending?.pickupCoords && pending?.destinationCoords
        ? pending
        : active?.handoffId
          ? active
          : pending;

  const handoffId = ctx?.handoffId;
  const pickupCoords = ctx?.pickupCoords;
  const destinationCoords = ctx?.destinationCoords;
  const rideType = ctx?.rideType || 'car';
  const carAc = Boolean(ctx?.carAc);

  if (pickupCoords && destinationCoords) {
    const key = buildCaptureStorageKey(pickupCoords, destinationCoords, rideType, carAc);
    if (key) {
      await saveCapturedFare(key, parsed.provider, parsed.fare, parsed.rawText);
    }
  }

  if (handoffId) {
    await patchHandoffCapture(handoffId, parsed.fare, parsed.provider);
    return true;
  }
  return false;
}

/**
 * Read the native scrape buffer that accumulates while Farely is in the provider app and
 * apply it (persist + PATCH). Lives here (not in accessibilityBridge) so the bridge stays
 * a pure native shim and we avoid the cycle bridge → pipeline → handoffCaptureSync → bridge.
 */
export async function drainBufferedUiCapture() {
  const data = await consumeBufferedUiCapture();
  if (!data) return null;
  await applyLiveCaptureEvent(data);
  return data;
}
