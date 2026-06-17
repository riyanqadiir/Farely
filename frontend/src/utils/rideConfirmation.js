import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'farely_pending_ride_confirmation_v1';

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export async function getPendingRideConfirmations() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return normalizeList(parsed);
  } catch (_) {
    return [];
  }
}

export async function addPendingRideConfirmation(payload) {
  if (!payload?.handoffId) return;
  try {
    const list = await getPendingRideConfirmations();
    const withoutDuplicate = list.filter((item) => item?.handoffId !== payload.handoffId);
    const next = [payload, ...withoutDuplicate].slice(0, 30);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (_) {}
}

export async function getPendingRideConfirmation() {
  const list = await getPendingRideConfirmations();
  return list[0] || null;
}

export async function removePendingRideConfirmation(handoffId) {
  if (!handoffId) return;
  try {
    const list = await getPendingRideConfirmations();
    const next = list.filter((item) => item?.handoffId !== handoffId);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (_) {}
}

export async function clearPendingRideConfirmation() {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

export async function patchPendingRideConfirmation(handoffId, patch) {
  if (!handoffId || !patch || typeof patch !== 'object') return;
  try {
    const list = await getPendingRideConfirmations();
    const next = list.map((item) =>
      item?.handoffId === handoffId ? { ...item, ...patch } : item
    );
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (_) {}
}

// Backward-compatible aliases
export const setPendingRideConfirmation = addPendingRideConfirmation;
