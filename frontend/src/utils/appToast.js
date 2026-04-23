let toastListener = null;

export function registerAppToastListener(listener) {
  toastListener = listener;
  return () => {
    if (toastListener === listener) toastListener = null;
  };
}

export function showAppToast(payload) {
  if (!toastListener) return;
  toastListener(payload || {});
}
