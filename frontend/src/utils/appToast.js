let toastListener = null;

export function registerAppToastListener(listener) {
  toastListener = listener;
  return () => {
    if (toastListener === listener) toastListener = null;
  };
}

/**
 * @param {object} payload
 * @param {number} [payload.durationMs] How long the toast stays visible (default set in AppToastHost).
 */
export function showAppToast(payload) {
  if (!toastListener) return;
  toastListener(payload || {});
}
