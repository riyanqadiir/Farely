import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'farely_active_capture_handoff_v1';

export async function setActiveCaptureHandoff(payload) {
  if (!payload?.handoffId) return;
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        ...payload,
        updatedAt: Date.now(),
      })
    );
  } catch (_) {}
}

export async function getActiveCaptureHandoff() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function clearActiveCaptureHandoff() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (_) {}
}
