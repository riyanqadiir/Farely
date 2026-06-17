/**
 * Coalesce rapid accessibility UI_DATA events (same provider spamming PKR tweaks)
 * into one UI update + one optional backend sync per debounce window.
 */

const DEFAULT_DEBOUNCE_MS = 400;

export function createLiveCaptureDebouncer(debounceMs = DEFAULT_DEBOUNCE_MS) {
  let timer = null;
  let pending = null;
  /** @type {Map<string, number>} */
  const lastAppliedRounded = new Map();

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  /**
   * @param {{ provider: string, fare: number, rawText?: string }} capture
   * @param {(capture: { provider: string, fare: number, rawText: string, changed: boolean }) => void | Promise<void>} onApply
   */
  const schedule = (capture, onApply) => {
    const provider = String(capture?.provider || '').trim();
    const fare = Number(capture?.fare);
    if (!provider || !Number.isFinite(fare) || fare <= 0) return;

    const rounded = Math.round(fare);
    pending = {
      provider,
      fare,
      rawText: typeof capture.rawText === 'string' ? capture.rawText : '',
    };

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const job = pending;
      pending = null;
      if (!job) return;

      const prev = lastAppliedRounded.get(job.provider);
      const changed = prev !== rounded;
      if (!changed) return;

      lastAppliedRounded.set(job.provider, rounded);
      void Promise.resolve(onApply({ ...job, changed: true }));
    }, debounceMs);
  };

  const reset = () => {
    clear();
    lastAppliedRounded.clear();
  };

  return { schedule, clear, reset };
}
