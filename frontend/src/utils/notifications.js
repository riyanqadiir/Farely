import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'app_notifications_v1';
const MAX_ITEMS = 120;

function pendingAccessKey(userId) {
  return `farely_pending_access_restore:${userId}`;
}

export async function getAppNotifications(forUserId = null) {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    if (!forUserId) return list;
    return list.filter((n) => !n || !n.userId || n.userId === forUserId);
  } catch (_) {
    return [];
  }
}

export async function pushAppNotification({ type = 'app', title, body, meta = {}, userId = null }) {
  if (!title || !body) return;
  try {
    const current = await getAppNotifications();
    const next = [
      {
        id: `n_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type,
        title,
        body,
        meta: meta && typeof meta === 'object' ? meta : {},
        userId,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch (_) {}
}

function formatBlockedUntilLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (_) {
    return null;
  }
}

/**
 * Persist a moderation event to the in-app notification list (device-local).
 * @param {object} payload
 * @param {'blocked'|'deleted'} payload.kind
 * @param {string|null} [payload.userId]
 */
export async function recordAccountModerationEvent(payload) {
  const userId = payload?.userId != null ? String(payload.userId) : null;
  if (!userId) return;

  if (payload.kind === 'deleted') {
    try {
      await AsyncStorage.removeItem(pendingAccessKey(userId));
    } catch (_) {}
    await pushAppNotification({
      type: 'account',
      title: 'Account no longer available',
      body:
        'This Farely account was removed. To continue, create a new account or contact support if this was a mistake.',
      userId,
      meta: { category: 'account_removed' },
    });
    return;
  }

  if (payload.kind !== 'blocked') return;

  const blockedUntil = payload.blockedUntil || null;
  const permanent = !blockedUntil;
  const reason = payload.reason || null;
  const message = payload.message || null;
  const baseText =
    message ||
    (reason
      ? `Reason: ${reason}`
      : permanent
        ? 'An administrator placed a permanent restriction on this account.'
        : 'An administrator placed a temporary restriction on this account.');

  const title = permanent ? 'Account permanently restricted' : 'Account temporarily restricted';

  let body = baseText;
  if (!permanent && blockedUntil) {
    const when = formatBlockedUntilLabel(blockedUntil);
    if (when) body = `${baseText}\n\nAccess is expected to be restored after ${when}.`;
  }

  await pushAppNotification({
    type: 'account',
    title,
    body,
    userId,
    meta: {
      category: 'account_blocked',
      blockedUntil,
      blockedAt: payload.blockedAt || null,
      reason,
    },
  });

  try {
    if (!permanent && blockedUntil) {
      await AsyncStorage.setItem(
        pendingAccessKey(userId),
        JSON.stringify({ blockedUntil, recordedAt: new Date().toISOString() })
      );
    } else {
      await AsyncStorage.removeItem(pendingAccessKey(userId));
    }
  } catch (_) {}
}

/**
 * Call after a successful `/auth/me` load when the user can use the app again.
 * If a temporary suspension was recorded locally, adds one "access restored" row.
 */
export async function maybeNotifyAccessRestored(user) {
  const uid = user?.id ?? user?._id;
  if (uid == null) return;
  const userId = String(uid);
  let pendingRaw = null;
  try {
    pendingRaw = await AsyncStorage.getItem(pendingAccessKey(userId));
  } catch (_) {
    return;
  }
  if (!pendingRaw) return;

  try {
    await AsyncStorage.removeItem(pendingAccessKey(userId));
  } catch (_) {}

  let pending = null;
  try {
    pending = JSON.parse(pendingRaw);
  } catch (_) {
    pending = null;
  }

  const untilMs = pending?.blockedUntil ? new Date(pending.blockedUntil).getTime() : NaN;
  const ended =
    Number.isFinite(untilMs) && Date.now() >= untilMs
      ? 'Your temporary restriction has ended and you can use Farely again.'
      : 'Your account access has been restored. You can use Farely again.';

  await pushAppNotification({
    type: 'account',
    title: 'Account access restored',
    body: ended,
    userId,
    meta: { category: 'access_restored' },
  });
}
