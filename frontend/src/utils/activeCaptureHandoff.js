import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'farely_active_capture_handoff_v1';

/** In-memory copy so capture works before AsyncStorage finishes (real devices). */
let memoryHandoff = null;

export async function setActiveCaptureHandoff(payload) {
  if (!payload?.handoffId) return;
  memoryHandoff = { ...payload, updatedAt: Date.now() };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(memoryHandoff));
  } catch (_) {}
}

export async function getActiveCaptureHandoff() {
  if (memoryHandoff) return memoryHandoff;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed) memoryHandoff = parsed;
    return parsed;
  } catch (_) {
    return null;
  }
}

export async function clearActiveCaptureHandoff() {
  memoryHandoff = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (_) {}
}
