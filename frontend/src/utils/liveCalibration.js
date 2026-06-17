/** Build POST body `liveCalibration` rows from saved provider fare scrapes. */

export function normalizeCalibrationProvider(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('yango') || v.includes('yandex')) return 'Yango';
  if (v.includes('bykea') || v.includes('bykia')) return 'Bykea';
  return '';
}

export function buildLiveCalibrationFromCaptures(captured) {
  return (Array.isArray(captured) ? captured : [])
    .map((c) => ({
      provider: normalizeCalibrationProvider(c?.provider),
      fare: Number(c?.fare),
    }))
    .filter(
      (c) =>
        (c.provider === 'Yango' || c.provider === 'Bykea')
        && Number.isFinite(c.fare)
        && c.fare > 0
    );
}
