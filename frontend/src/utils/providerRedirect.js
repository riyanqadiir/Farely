import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

const APP_CALLBACK_URL = 'farely://provider-return';

/** Set EXPO_PUBLIC_DEBUG_PROVIDER_REDIRECT=true in .env to log each URL tried (Metro console). */
function debugRedirect(...args) {
  const on =
    process.env.EXPO_PUBLIC_DEBUG_PROVIDER_REDIRECT === 'true'
    || process.env.EXPO_PUBLIC_DEBUG_PROVIDER_REDIRECT === '1'
    || Constants?.expoConfig?.extra?.debugProviderRedirect === true;
  if (on) {
    // eslint-disable-next-line no-console
    console.log('[Farely:providerRedirect]', ...args);
  }
}

const toIntentCoords = (coords) => `${coords.latitude},${coords.longitude}`;

/**
 * @typedef {Object} RideHandoff
 * @property {'bike'|'rickshaw'|'car'} rideType
 * @property {boolean} [carAc] meaningful when rideType === 'car'
 */

function normalizeRideHandoff(handoff) {
  if (!handoff || typeof handoff.rideType !== 'string') return null;
  const rt = handoff.rideType.trim().toLowerCase();
  const rideType = rt === 'bike' || rt === 'rickshaw' || rt === 'car' ? rt : 'car';
  const carAc = rideType === 'car' && Boolean(handoff.carAc);
  return { rideType, carAc };
}

/**
 * Yango / Yandex Go: `tariffClass` on go.link + AppMetrica route links.
 * - Docs: https://yandex.com/support/taxi-distr/en/api/deeplinks
 * - Rickshaw: `econom` selects economy *car*; Yango markets tuk-tuk as its own class (see e.g.
 *   https://yango.com/maputo/tariff/tuktuk/ slug `tuktuk`). Try likely regional ids before `econom`.
 */
function yangoTariffCandidatesForHandoff(handoff) {
  const h = normalizeRideHandoff(handoff);
  if (!h) return ['econom'];
  if (h.rideType === 'bike') return ['moto'];
  if (h.rideType === 'rickshaw') {
    return ['tuktuk', 'rickshaw', 'tuk_tuk', 'econom'];
  }
  if (h.rideType === 'car' && h.carAc) return ['business'];
  return ['econom'];
}

function yangoTariffClassFromHandoff(handoff) {
  return yangoTariffCandidatesForHandoff(handoff)[0];
}

/** Query fragment for Yango scheme URLs: mirror primary tariff attempt. */
function yangoHandoffQueryString(handoff) {
  const h = normalizeRideHandoff(handoff);
  if (!h) return '';
  const tc = yangoTariffClassFromHandoff(handoff);
  return `tariffClass=${encodeURIComponent(tc)}`;
}

/**
 * Bykea: no public spec. Prefer short `mode` / `type` / `rideType` keys (common in mobile apps)
 * plus `ac` for cars; path-segment variants are prepended separately in buildBykeaDeepLinkCandidates.
 */
function bykeaHandoffQueryString(handoff) {
  const h = normalizeRideHandoff(handoff);
  if (!h) return '';
  if (h.rideType === 'bike') {
    return 'mode=bike&type=bike&rideType=bike&service=bike';
  }
  if (h.rideType === 'rickshaw') {
    return 'mode=rickshaw&type=rickshaw&rideType=rickshaw&service=rickshaw';
  }
  return [
    'mode=car',
    'type=car',
    'rideType=car',
    `ac=${h.carAc ? '1' : '0'}`,
    `carAc=${h.carAc ? 'true' : 'false'}`,
  ].join('&');
}

/** Generic keys for providers without a documented scheme (legacy / unknown). */
function genericHandoffQueryString(handoff) {
  const h = normalizeRideHandoff(handoff);
  if (!h) return '';
  const vehicleType =
    h.rideType === 'bike' ? 'bike'
      : h.rideType === 'rickshaw' ? 'rickshaw'
        : h.carAc ? 'car_ac' : 'car';
  const parts = [
    `ride_type=${encodeURIComponent(h.rideType)}`,
    `vehicle_type=${encodeURIComponent(vehicleType)}`,
    `ride_mode=${encodeURIComponent(h.rideType)}`,
  ];
  if (h.rideType === 'car') {
    parts.push(`car_ac=${h.carAc ? '1' : '0'}`);
    parts.push(`ac=${h.carAc ? '1' : '0'}`);
    parts.push(`vehicle_class=${encodeURIComponent(h.carAc ? 'comfort' : 'econom')}`);
  }
  return parts.join('&');
}

function handoffQueryForProvider(handoff, providerKey) {
  if (!normalizeRideHandoff(handoff)) return '';
  if (providerKey === 'yango') return yangoHandoffQueryString(handoff);
  if (providerKey === 'bykea') return bykeaHandoffQueryString(handoff);
  return genericHandoffQueryString(handoff);
}

function shouldAugmentUrlWithHandoff(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('geo:')) return false;
  // Intent and android-app URLs have strict formats; appending query params can invalidate them.
  if (url.startsWith('intent:')) return false;
  if (url.startsWith('android-app://')) return false;
  return true;
}

function appendProviderHandoff(url, handoff, providerKey) {
  if (!shouldAugmentUrlWithHandoff(url)) return url;
  if (providerKey === 'yango' && url.includes('tariffClass=')) {
    return url;
  }
  if (providerKey === 'bykea' && /\b(mode|rideType)=/.test(url)) {
    return url;
  }
  const qs = handoffQueryForProvider(handoff, providerKey);
  if (!qs) return url;
  const hashIdx = url.indexOf('#');
  if (hashIdx !== -1) {
    const base = url.slice(0, hashIdx);
    const frag = url.slice(hashIdx);
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${qs}${frag}`;
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${qs}`;
}

function mapUrlsWithProviderHandoff(urls, handoff, providerKey) {
  if (!normalizeRideHandoff(handoff)) return urls;
  return urls.map((u) => appendProviderHandoff(u, handoff, providerKey));
}

/**
 * Partner doc: "Generating links" — https://yango.com/en_int/partner-program/documentation/#Generating_links
 * Route handoff uses HTTPS yango.go.link; Android resolves via ACTION_VIEW (Linking.openURL).
 * adj_fallback web order uses gfrom/gto as longitude,latitude per template.
 */
function buildOfficialYangoGoLinkForTariff(pickup, dropoff, ref, tariffClass) {
  const slat = pickup.latitude;
  const slon = pickup.longitude;
  const elat = dropoff.latitude;
  const elon = dropoff.longitude;
  const fallbackOrderUrl =
    `https://yango.com/en_int/order/?gfrom=${slon},${slat}&gto=${elon},${elat}&ref=${encodeURIComponent(ref)}`;
  const adjFallback = encodeURIComponent(fallbackOrderUrl);
  const tariffPart = tariffClass
    ? `&tariffClass=${encodeURIComponent(tariffClass)}`
    : '';
  return (
    'https://yango.go.link/route?'
    + `start-lat=${slat}&start-lon=${slon}&end-lat=${elat}&end-lon=${elon}`
    + `&ref=${encodeURIComponent(ref)}`
    + '&adj_t=vokme8e_nd9s9z9'
    + '&lang=en'
    + '&adj_deeplink_js=1'
    + tariffPart
    + `&adj_fallback=${adjFallback}`
  );
}

/** Optional: Yandex Go distribution redirect; only if explicitly enabled (wrong ID can open wrong product). */
function buildAppmetricaYangoRouteUrlForTariff(pickup, dropoff, tariffClass) {
  const tc = encodeURIComponent(tariffClass || 'econom');
  return (
    `https://3.redirect.appmetrica.yandex.com/route?start-lat=${pickup.latitude}`
    + `&start-lon=${pickup.longitude}`
    + `&end-lat=${dropoff.latitude}`
    + `&end-lon=${dropoff.longitude}`
    + `&tariffClass=${tc}`
    + '&ref=farely'
    + '&appmetrica_tracking_id=1178268795219780156'
  );
}

function useYangoAppmetricaRedirect() {
  const flag =
    process.env.EXPO_PUBLIC_YANGO_APPMETRICA_REDIRECT
    || Constants?.expoConfig?.extra?.yangoAppmetricaRedirect;
  return String(flag || '').toLowerCase() === 'true' || flag === '1';
}

/** Google Play package for Bykea (Pakistan). */
const BYKEA_ANDROID_PACKAGE = 'com.bykea.pk';

/**
 * Bykea: no public passenger deeplink spec found. Candidates follow common
 * ride-app patterns (custom scheme + pickup/drop query shapes, geo:, package launch).
 * Order: structured URLs first, then bare scheme, geo, then package intents as last resort.
 */
function bykeaServicePathSegment(handoff) {
  const h = normalizeRideHandoff(handoff);
  if (!h) return 'ride';
  if (h.rideType === 'bike') return 'bike';
  if (h.rideType === 'rickshaw') return 'rickshaw';
  return 'car';
}

/**
 * Observed via logcat analytics events on device:
 * - bike => trip_type=23
 * - rickshaw => trip_type=70
 * - car (no AC) => trip_type=44
 * - car (AC) => trip_type=45
 */
function bykeaTripTypeFromHandoff(handoff) {
  const h = normalizeRideHandoff(handoff);
  if (!h) return null;
  if (h.rideType === 'bike') return 23;
  if (h.rideType === 'rickshaw') return 70;
  if (h.rideType === 'car') return h.carAc ? 45 : 44;
  return null;
}

function buildBykeaDeepLinkCandidates(pickup, dropoff, handoff) {
  const plat = pickup.latitude;
  const plon = pickup.longitude;
  const dlat = dropoff.latitude;
  const dlon = dropoff.longitude;
  const pickupLatLng = `${plat},${plon}`;
  const dropLatLng = `${dlat},${dlon}`;
  const pickupLngLat = `${plon},${plat}`;
  const dropLngLat = `${dlon},${dlat}`;
  const seg = bykeaServicePathSegment(handoff);
  const h = normalizeRideHandoff(handoff);
  const tripType = bykeaTripTypeFromHandoff(handoff);
  const carAcQ = h && h.rideType === 'car'
    ? `&ac=${h.carAc ? '1' : '0'}&carAc=${h.carAc ? 'true' : 'false'}`
    : '';
  const flatModeQs = h ? bykeaHandoffQueryString(handoff) : '';

  /** Path + mode-in-query variants first (best chance if app routes by path or mode=). */
  const prioritized = [];
  if (flatModeQs) {
    prioritized.push(
      `bykea://open/ride?pickup=${pickupLatLng}&dropoff=${dropLatLng}&${flatModeQs}`,
      `bykeapk://open/ride?pickup=${pickupLatLng}&dropoff=${dropLatLng}&${flatModeQs}`,
      ...(typeof tripType === 'number'
        ? [
            `bykea://open/ride?pickup=${pickupLatLng}&dropoff=${dropLatLng}&${flatModeQs}&trip_type=${tripType}`,
            `bykeapk://open/ride?pickup=${pickupLatLng}&dropoff=${dropLatLng}&${flatModeQs}&trip_type=${tripType}`,
          ]
        : [])
    );
  }
  prioritized.push(
    `bykea://open/ride/${seg}?pickup=${pickupLatLng}&dropoff=${dropLatLng}${carAcQ}`,
    `bykea://ride/${seg}?pickup=${pickupLatLng}&dropoff=${dropLatLng}${carAcQ}`,
    `bykea://open/${seg}?pickup=${pickupLatLng}&dropoff=${dropLatLng}${carAcQ}`,
    `bykea://booking/${seg}?pickup_lat=${plat}&pickup_lng=${plon}&drop_lat=${dlat}&drop_lng=${dlon}${carAcQ}`,
    `bykeapk://open/ride/${seg}?pickup=${pickupLatLng}&dropoff=${dropLatLng}${carAcQ}`,
  );

  const list = [
    ...prioritized,
    `bykea://open/ride?pickup=${pickupLatLng}&dropoff=${dropLatLng}`,
    `bykea://ride?pickup=${pickupLatLng}&dropoff=${dropLatLng}`,
    `bykea://book?pickup_lat=${plat}&pickup_lng=${plon}&drop_lat=${dlat}&drop_lng=${dlon}`,
    `bykea://order?from_lat=${plat}&from_lng=${plon}&to_lat=${dlat}&to_lng=${dlon}`,
    `bykea://map?s_lat=${plat}&s_lng=${plon}&d_lat=${dlat}&d_lng=${dlon}`,
    `bykea://home?pickup=${pickupLatLng}&destination=${dropLatLng}`,
    `bykeapk://open/ride?pickup=${pickupLatLng}&dropoff=${dropLatLng}`,
    `bykeapk://ride?pickup=${pickupLatLng}&dropoff=${dropLatLng}`,
    `bykea://open/ride?pickup=${pickupLngLat}&dropoff=${dropLngLat}`,
    'bykea://',
    'bykeapk://',
  ];
  // Prefer geo before plain package launch so users at least get destination map pinned.
  list.push(`geo:${dlat},${dlon}?q=${encodeURIComponent(`${dlat},${dlon}`)}`);

  if (Platform.OS === 'android') {
    // Keep intent-based trip_type at the end: explicit intents can force an unintended default screen
    // on some Bykea builds. We prefer URL-based location handoff first.
    // Keep package intents after geo fallback: they can open app home without route prefill.
    if (typeof tripType === 'number') {
      list.push(
        `intent:#Intent;package=${BYKEA_ANDROID_PACKAGE};`
        + 'action=android.intent.action.VIEW;'
        + `component=${BYKEA_ANDROID_PACKAGE}/com.bykea.pk.screens.activities.create_ride.CreateRideBookingActivity;`
        + `i.trip_type=${tripType};`
        + 'end'
      );
    }
    list.push(`intent:#Intent;package=${BYKEA_ANDROID_PACKAGE};end`);
    list.push(`android-app://${BYKEA_ANDROID_PACKAGE}`);
  }

  return mapUrlsWithProviderHandoff(list, handoff, 'bykea');
}


const PROVIDER_LINKS = {
  Yango: {
    deepLinkCandidates: ({ pickup, dropoff, handoff }) => {
      const pickupStr = toIntentCoords(pickup);
      const dropoffStr = toIntentCoords(dropoff);
      const callback = encodeURIComponent(`${APP_CALLBACK_URL}?provider=Yango`);
      const ridePayload = encodeURIComponent(JSON.stringify({
        pickup: { lat: pickup.latitude, lng: pickup.longitude },
        dropoff: { lat: dropoff.latitude, lng: dropoff.longitude },
        tariffClass: normalizeRideHandoff(handoff)
          ? yangoTariffClassFromHandoff(handoff)
          : undefined,
        tariffClassCandidates: normalizeRideHandoff(handoff)
          ? yangoTariffCandidatesForHandoff(handoff)
          : undefined,
        rideType: normalizeRideHandoff(handoff)?.rideType,
        carAc: normalizeRideHandoff(handoff)?.carAc ?? false,
      }));

      const tariffs = yangoTariffCandidatesForHandoff(handoff);
      // 1) Official go.link — try tariff ids in order (rickshaw: tuktuk before econom car).
      const list = tariffs.map((tc) => buildOfficialYangoGoLinkForTariff(pickup, dropoff, 'farely', tc));

      if (useYangoAppmetricaRedirect()) {
        tariffs.forEach((tc) => {
          list.push(buildAppmetricaYangoRouteUrlForTariff(pickup, dropoff, tc));
        });
      }

      // 2) Geo intent (standard Android geo: URI).
      list.push(
        `geo:${dropoff.latitude},${dropoff.longitude}?q=${dropoff.latitude},${dropoff.longitude}`
      );

      // 3) Minimal app open (no route guarantee).
      list.push('yandexyango://', 'yango://');

      // 4) Undocumented query variants — last resort before package-only launch.
      list.push(
        `yandexyango://ride?pickup=${pickupStr}&dropoff=${dropoffStr}&callback_url=${callback}&payload=${ridePayload}`,
        `yandexyango://taxi?pickup=${pickupStr}&dropoff=${dropoffStr}&callback_url=${callback}&payload=${ridePayload}`,
        `yango://ride?pickup=${pickupStr}&dropoff=${dropoffStr}&callback_url=${callback}`,
        `yango://taxi?pickup=${pickupStr}&dropoff=${dropoffStr}&callback_url=${callback}`,
        'android-app://com.yandex.yango'
      );

      if (Platform.OS === 'android') {
        list.push(
          `intent://ride?pickup=${pickupStr}&dropoff=${dropoffStr}#Intent;scheme=yango;package=com.yandex.yango;end`,
          `intent://taxi?pickup=${pickupStr}&dropoff=${dropoffStr}#Intent;scheme=yango;package=com.yandex.yango;end`,
          'intent://#Intent;package=com.yandex.yango;end'
        );
      }

      return mapUrlsWithProviderHandoff(list, handoff, 'yango');
    },
    appPresenceScheme: 'yandexyango://',
    fallback: 'https://yango.com/en_int/',
  },
  Bykea: {
    deepLinkCandidates: ({ pickup, dropoff, handoff }) => buildBykeaDeepLinkCandidates(pickup, dropoff, handoff),
    appPresenceScheme: 'bykea://',
    fallback: Platform.OS === 'android'
      ? `https://play.google.com/store/apps/details?id=${BYKEA_ANDROID_PACKAGE}`
      : 'https://apps.apple.com/app/bykea-rides-delivery-app/id1351179184',
  },
};

export async function redirectToProvider(providerName, pickupCoords, destinationCoords, rideHandoff = null) {
  const config = PROVIDER_LINKS[providerName];
  if (!config) {
    return { success: false, mode: 'unknown', reason: 'unsupported_provider' };
  }

  const deepLinkCandidates = config.deepLinkCandidates({
    pickup: pickupCoords || { latitude: 0, longitude: 0 },
    dropoff: destinationCoords || { latitude: 0, longitude: 0 },
    handoff: normalizeRideHandoff(rideHandoff) || undefined,
  });
  let appInstalled = false;

  if (config.appPresenceScheme) {
    try {
      appInstalled = await Linking.canOpenURL(config.appPresenceScheme);
    } catch (_) {
      // Android 11+ requires <queries> in the manifest; treat as unknown and still try deep links.
      appInstalled = true;
    }
  }

  debugRedirect(providerName, 'candidates', deepLinkCandidates.length);
  for (const deepLinkUrl of deepLinkCandidates) {
    try {
      debugRedirect(providerName, 'try', deepLinkUrl);
      await Linking.openURL(deepLinkUrl);
      debugRedirect(providerName, 'opened', deepLinkUrl);
      return { success: true, mode: 'deep_link', openedUrl: deepLinkUrl };
    } catch (e) {
      debugRedirect(providerName, 'fail', deepLinkUrl, e?.message || e);
    }
  }

  if (appInstalled) {
    return {
      success: false,
      mode: 'deep_link',
      reason: 'app_installed_but_route_not_supported',
    };
  }

  try {
    await Linking.openURL(config.fallback);
    return { success: true, mode: 'fallback_url', openedUrl: config.fallback };
  } catch (_) {
    return { success: false, mode: 'fallback_url', reason: 'fallback_open_failed' };
  }
}

export function parseProviderReturnUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'farely:' || parsed.hostname !== 'provider-return') {
      return null;
    }
    return {
      provider: parsed.searchParams.get('provider') || '',
      returnedPrice: parsed.searchParams.get('price') || null,
      returnedCurrency: parsed.searchParams.get('currency') || null,
    };
  } catch (_) {
    return null;
  }
}
