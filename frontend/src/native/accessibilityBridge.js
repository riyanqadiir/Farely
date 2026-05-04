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
