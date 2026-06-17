/**
 * Live-traffic hotspots: client wrapper around GET /rides/traffic-hotspots.
 * Same data the Farely Admin Console renders on its map. Used by the
 * mobile app to apply a surge multiplier to displayed fares.
 */
import farelyApi from './farelyApi';

export const hotspotsApi = {
  /**
   * @param {{ city?: string }} [params]
   * @returns Promise<{
   *   fetchedAt: string,
   *   cities: string[],
   *   summary: { totalAreas, availableAreas, highSurgeCount, avgDelayMinutes },
   *   items: Array<{
   *     key, name, city, lat, lng,
   *     duration: number|null, durationInTraffic: number|null,
   *     congestionRatio: number|null, delayMinutes: number|null,
   *     surgeMultiplier: number, surgeLevel: 'high'|'medium'|'low'|'normal',
   *     surgePercent: number, available: boolean
   *   }>
   * }>
   */
  list: async (params = {}) => {
    const res = await farelyApi.get('/rides/traffic-hotspots', { params });
    return res.data?.data || null;
  },
};
