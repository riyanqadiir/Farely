import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'app_notifications_v1';
const MAX_ITEMS = 120;

export async function getAppNotifications() {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export async function pushAppNotification({ type = 'app', title, body, meta = {} }) {
  if (!title || !body) return;
  try {
    const current = await getAppNotifications();
    const next = [
      {
        id: `n_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type,
        title,
        body,
        meta,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch (_) {}
}

