import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'farely_payment_methods_v1';

function genId() {
  return `pm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getPaymentMethods() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePaymentMethods(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function addPaymentMethod(card) {
  const list = await getPaymentMethods();
  const next = { ...card, id: card.id || genId(), isDefault: !!card.isDefault };
  if (next.isDefault) {
    list.forEach((c) => {
      c.isDefault = false;
    });
  }
  list.push(next);
  await savePaymentMethods(list);
  return next;
}

export async function updatePaymentMethod(id, patch) {
  const list = await getPaymentMethods();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  if (patch.isDefault) {
    list.forEach((c) => {
      c.isDefault = c.id === id;
    });
  }
  list[idx] = { ...list[idx], ...patch, id };
  if (!list.some((c) => c.isDefault) && list.length) {
    list[0].isDefault = true;
  }
  await savePaymentMethods(list);
  return list[idx];
}

export async function removePaymentMethod(id) {
  const list = (await getPaymentMethods()).filter((c) => c.id !== id);
  if (list.length && !list.some((c) => c.isDefault)) {
    list[0].isDefault = true;
  }
  await savePaymentMethods(list);
}
