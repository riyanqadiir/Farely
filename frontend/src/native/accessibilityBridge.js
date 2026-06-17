import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

/**
 * Tells the accessibility layer which Farely ride handoff is active so Bykea UI text
 * can be filtered (bike vs rickshaw vs car). Call when ride type changes or before opening a provider.
 */
export function syncCaptureHandoffToNative(rideType, carAc) {
  if (Platform.OS !== "android") return;
  try {
    const mod = NativeModules.FareAccessibilityModule;
    mod?.setCaptureHandoff?.(String(rideType || "car"), !!carAc);
  } catch (_) {}
}

export function subscribeToUiData(onData) {
  if (Platform.OS !== "android") {
    return { remove: () => {} };
  }
  return DeviceEventEmitter.addListener("UI_DATA", onData);
}

export function subscribeToUiDataDebug(onData) {
  if (Platform.OS !== "android") {
    return { remove: () => {} };
  }
  return DeviceEventEmitter.addListener("UI_DATA_DEBUG", onData);
}

/**
 * Fare scraped while Farely was backgrounded in the provider app.
 * Pure native bridge — does NOT touch the capture pipeline (liveCapturePipeline owns
 * orchestration so we don't import the pipeline here and create a require cycle).
 */
export async function consumeBufferedUiCapture() {
  if (Platform.OS !== "android") return null;
  try {
    const mod = NativeModules.FareAccessibilityModule;
    if (!mod?.consumeBufferedCapture) return null;
    const data = await mod.consumeBufferedCapture();
    if (!data?.provider || !Number.isFinite(Number(data.fare))) return null;
    return {
      provider: data.provider,
      fare: typeof data.fare === "number" ? data.fare : Number(data.fare),
      rawText: typeof data.rawText === "string" ? data.rawText : "",
    };
  } catch (_) {
    return null;
  }
}
