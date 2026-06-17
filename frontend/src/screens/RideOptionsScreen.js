import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import farelyApi from '../api/farelyApi';
import { getProviderLogo } from '../constants/brandAssets';
import { pushAppNotification } from '../utils/notifications';
import { redirectToProvider } from '../utils/providerRedirect';
import { useTheme } from '../theme/ThemeContext';
import { setPendingRideConfirmation } from '../utils/rideConfirmation';
import { buildRouteHandoffBody, hasValidRouteEndpoints } from '../utils/rideRoute';
import { buildLiveCalibrationFromCaptures } from '../utils/liveCalibration';
import { getCapturedFaresForContext } from '../utils/liveFareStore';
import { showAppToast } from '../utils/appToast';
import {
  subscribeToUiData,
  syncCaptureHandoffToNative,
} from '../native/accessibilityBridge';
import { createLiveCaptureDebouncer } from '../utils/liveCaptureDebounced';
import { setActiveCaptureHandoff } from '../utils/activeCaptureHandoff';
import { applyLiveCaptureEvent, drainBufferedUiCapture } from '../utils/liveCapturePipeline';
import {
  flushStoredCaptureToHandoff,
  patchHandoffCapture,
} from '../utils/handoffCaptureSync';
import { applyYangoBykeaMinSpread } from '../utils/yangoBykeaFareSpread';
import {
  getHotspotItems,
  pickSurgeZone,
  applySurgeToFare,
  NEUTRAL_SURGE,
  getSurgeChipPalette,
  coordsToLatLng,
} from '../utils/surgeStore';

const normalizeProvider = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('yango') || v.includes('yandex')) return 'Yango';
  if (v.includes('bykea') || v.includes('bykia')) return 'Bykea';
  if (v.includes('indrive') || v.includes('in drive') || v.includes('in-drive')) return 'InDrive';
  return String(value || '').trim();
};

const isPakistanCompareProvider = (name) => {
  const p = normalizeProvider(name).toLowerCase();
  return p === 'yango' || p === 'bykea';
};

function mergeCapturesIntoFares(fares, capturedList) {
  const list = Array.isArray(fares) ? fares : [];
  const caps = Array.isArray(capturedList) ? capturedList : [];
  if (!caps.length) return list;

  return list.map((item) => {
    const key = normalizeProvider(item?.provider).toLowerCase();
    const match = caps.find(
      (c) => normalizeProvider(c?.provider).toLowerCase() === key
    );
    const fare = typeof match?.fare === 'number' ? match.fare : Number(match?.fare);
    if (!match || !Number.isFinite(fare) || fare <= 0) return item;
    return {
      ...item,
      fare,
      estimateConfidence: 1,
      fareSource: 'live_capture',
    };
  });
}

function pickLatestCapture(capturedList, preferredProvider) {
  const caps = Array.isArray(capturedList) ? capturedList : [];
  if (!caps.length) return null;
  const pref = String(preferredProvider || '').trim().toLowerCase();
  if (pref) {
    const match = caps.find(
      (c) => normalizeProvider(c?.provider).toLowerCase() === pref
    );
    if (match) return match;
  }
  return caps.reduce((best, c) => {
    const at = typeof c?.capturedAt === 'number' ? c.capturedAt : 0;
    const bestAt = typeof best?.capturedAt === 'number' ? best.capturedAt : 0;
    return at >= bestAt ? c : best;
  }, caps[0]);
}

/** After a successful deep link, show pickup/drop digits for known providers. */
const MANUAL_COORDS_ALERT_TITLE_BY_PROVIDER = {
  Yango: 'Yango opened',
  Bykea: 'Bykea opened',
};

function RideOptionCard({ item, bookingLoadingId, openDisabled, onOpenApp, colors, styles }) {
  const isBooking = bookingLoadingId === item.id;
  const disabled = !!bookingLoadingId || openDisabled;
  const logo = getProviderLogo(item.provider);
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.cardLeft}>
        <View style={styles.providerRow}>
          {!!logo && <Image source={logo} style={styles.providerLogo} resizeMode="contain" />}
          <Text style={[styles.provider, { color: colors.text }]}>{item.provider}</Text>
        </View>
        <Text style={[styles.ride, { color: colors.textSecondary }]}>
          {(item.name || item.rideType)} • {item.eta} •{' '}
          {typeof item.distanceKm === 'number' ? `${item.distanceKm} km` : '—'}
        </Text>
        <Text style={[styles.riderMeta, { color: colors.textMuted }]}>
          {item.fareSource === 'live_capture'
            ? 'Live fare captured from provider app'
            : item.fareSource === 'scraped_blend'
              ? 'Estimate blended with scraped Yango / Bykea fare'
              : `Estimate confidence: ${Math.round((item.estimateConfidence || 0) * 100)}%`}
        </Text>
      </View>

      <View style={styles.cardRight}>
        <Text style={[styles.price, { color: colors.text }]}>PKR {Math.round(item.fare)}</Text>
        <TouchableOpacity
          style={[
            styles.bookBtn,
            { backgroundColor: colors.accent },
            isBooking ? styles.bookBtnDisabled : null,
          ]}
          onPress={() => onOpenApp(item)}
          disabled={disabled}
        >
          {isBooking ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={[styles.bookBtnText, { color: colors.onAccent }]}>Open app</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const RideOptionsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(), []);

  const pickup = route?.params?.pickup ?? '';
  const destination = route?.params?.destination ?? '';
  const initialRideType = route?.params?.rideType ?? 'car';
  const initialSortBy = route?.params?.sortBy ?? 'fare';
  const incomingFares = route?.params?.fares ?? [];
  const estimateFares = route?.params?.estimateFares ?? [];
  const routeBaseFare = route?.params?.baseFare;
  const routeDistanceKm = route?.params?.distanceKm;
  const searchLogId = route?.params?.searchLogId;
  const pickupCoords = route?.params?.pickupCoords;
  const destinationCoords = route?.params?.destinationCoords;
  const initialCarAc = Boolean(route?.params?.carAc);
  const compareCalibrated = Boolean(route?.params?.compareCalibrated);

  const [bannerBaseFare, setBannerBaseFare] = useState(() =>
    typeof routeBaseFare === 'number' && Number.isFinite(routeBaseFare) ? routeBaseFare : null
  );
  const [bannerCalibrated, setBannerCalibrated] = useState(compareCalibrated);

  const [rideType] = useState(initialRideType);
  const [carAc] = useState(initialCarAc);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [faresBase, setFaresBase] = useState([]);
  const [bookingLoadingId, setBookingLoadingId] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');
  const [capturedFareText, setCapturedFareText] = useState('');
  const [capturedProvider, setCapturedProvider] = useState('');
  const [capturedFare, setCapturedFare] = useState(null);
  const [bykeaConfirmOption, setBykeaConfirmOption] = useState(null);
  const [surge, setSurge] = useState(NEUTRAL_SURGE);
  /** loading | ready | failed | skipped (no valid coords for plan-route) */
  const [routeReady, setRouteReady] = useState(() =>
    hasValidRouteEndpoints(pickupCoords, destinationCoords) ? 'loading' : 'skipped'
  );

  const mountedRef = useRef(true);
  const pendingCaptureRef = useRef(null);
  /** Farely model estimates at compare time — never overwritten by live provider scrapes (for ride logs). */
  const loggedEstimatesRef = useRef(new Map());
  const activeHandoffIdRef = useRef(null);
  const plannedHandoffIdRef = useRef(null);
  const planRouteRequestedRef = useRef(false);
  const captureDebouncerRef = useRef(null);
  if (!captureDebouncerRef.current) {
    captureDebouncerRef.current = createLiveCaptureDebouncer(450);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      captureDebouncerRef.current?.clear?.();
    };
  }, []);

  useEffect(() => {
    syncCaptureHandoffToNative(rideType, rideType === 'car' ? carAc : false);
  }, [rideType, carAc]);

  /** Align minimum banner with Home when compare omitted liveCalibration (stale params / deep link). */
  useEffect(() => {
    if (!hasValidRouteEndpoints(pickupCoords, destinationCoords)) return;

    let cancelled = false;
    (async () => {
      const captured = await getCapturedFaresForContext(
        pickupCoords,
        destinationCoords,
        rideType,
        carAc
      );
      const liveCalibration = buildLiveCalibrationFromCaptures(captured);
      const hasLiveCards = (Array.isArray(incomingFares) ? incomingFares : []).some(
        (item) => item?.fareSource === 'live_capture'
      );

      if (compareCalibrated && typeof routeBaseFare === 'number' && Number.isFinite(routeBaseFare)) {
        if (!cancelled) {
          setBannerBaseFare(routeBaseFare);
          setBannerCalibrated(true);
        }
        return;
      }

      if (!liveCalibration.length && !hasLiveCards) return;

      try {
        const res = await farelyApi.post('/rides/estimate-min', {
          pickupLat: pickupCoords.latitude,
          pickupLng: pickupCoords.longitude,
          destinationLat: destinationCoords.latitude,
          destinationLng: destinationCoords.longitude,
          rideType,
          carAc: rideType === 'car' ? carAc : false,
          ...(liveCalibration.length ? { liveCalibration } : {}),
        });
        if (cancelled) return;
        const d = res.data || {};
        if (typeof d.baseFare === 'number' && Number.isFinite(d.baseFare)) {
          setBannerBaseFare(d.baseFare);
        }
        setBannerCalibrated(Boolean(d.calibratedFromScrapes));
      } catch (_) {
        // Keep navigation params on failure.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    pickupCoords,
    destinationCoords,
    rideType,
    carAc,
    compareCalibrated,
    routeBaseFare,
    incomingFares,
  ]);

  const baseFareList = useCallback(() => {
    const list = Array.isArray(incomingFares) ? incomingFares : [];
    return list.filter((item) => isPakistanCompareProvider(item?.provider));
  }, [incomingFares]);

  const applyCaptureToCardState = useCallback((capture) => {
    if (!capture?.provider || !Number.isFinite(capture.fare)) return;
    setCapturedProvider(capture.provider);
    setCapturedFare(capture.fare);
    setCapturedFareText(
      capture.rawText || `${capture.provider} PKR ${Math.round(capture.fare)}`
    );
    setFaresBase((prev) => {
      const base =
        Array.isArray(prev) && prev.length ? prev : baseFareList();
      const next = mergeCapturesIntoFares(base, [capture]);
      return applyYangoBykeaMinSpread(next);
    });
  }, [baseFareList]);

  const refreshCardsFromStoredCaptures = useCallback(
    async (preferredProvider) => {
      if (!hasValidRouteEndpoints(pickupCoords, destinationCoords)) return;
      await drainBufferedUiCapture();
      const captured = await getCapturedFaresForContext(
        pickupCoords,
        destinationCoords,
        rideType,
        carAc
      );
      if (!captured.length || !mountedRef.current) return;

      setFaresBase((prev) => {
        const base = Array.isArray(prev) && prev.length ? prev : baseFareList();
        return applyYangoBykeaMinSpread(mergeCapturesIntoFares(base, captured));
      });

      const latest = pickLatestCapture(captured, preferredProvider || capturedProvider);
      if (latest) {
        const provider = normalizeProvider(latest.provider);
        const fare = typeof latest.fare === 'number' ? latest.fare : Number(latest.fare);
        if (provider && Number.isFinite(fare) && fare > 0) {
          setCapturedProvider(provider);
          setCapturedFare(fare);
          setCapturedFareText(
            latest.rawText || `${provider} PKR ${Math.round(fare)}`
          );
        }
      }
    },
    [pickupCoords, destinationCoords, rideType, carAc, baseFareList, capturedProvider]
  );

  const flushPendingCapture = async (handoffId, preferredProvider) => {
    if (!handoffId) return;
    await drainBufferedUiCapture();
    const queued = pendingCaptureRef.current;
    if (queued) {
      await patchHandoffCapture(handoffId, queued.fare, queued.provider);
      pendingCaptureRef.current = null;
      if (mountedRef.current) applyCaptureToCardState(queued);
      return;
    }
    await flushStoredCaptureToHandoff(
      handoffId,
      pickupCoords,
      destinationCoords,
      rideType,
      carAc,
      preferredProvider
    );
    await refreshCardsFromStoredCaptures(preferredProvider);
  };

  useEffect(() => {
    if (!hasValidRouteEndpoints(pickupCoords, destinationCoords)) {
      setRouteReady('skipped');
      return;
    }
    if (planRouteRequestedRef.current) return;
    planRouteRequestedRef.current = true;
    setRouteReady('loading');

    const body = buildRouteHandoffBody({
      searchLogId,
      pickup,
      destination,
      pickupCoords,
      destinationCoords,
      rideType,
      carAc,
    });

    (async () => {
      try {
        const res = await farelyApi.post('/rides/ride-handoff/plan-route', body);
        const id = res?.data?.id;
        if (id) {
          plannedHandoffIdRef.current = id;
          activeHandoffIdRef.current = id;
        }
        if (mountedRef.current) setRouteReady(id ? 'ready' : 'failed');
      } catch (_) {
        if (mountedRef.current) {
          setRouteReady('failed');
          showAppToast({
            title: 'Could not register route',
            body: 'Open app is disabled until pickup and drop-off are saved.',
            tone: 'error',
          });
        }
      }
    })();
  }, [
    searchLogId,
    pickup,
    destination,
    pickupCoords,
    destinationCoords,
    rideType,
    carAc,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const handoffId = activeHandoffIdRef.current;
      if (handoffId) {
        void flushPendingCapture(handoffId, capturedProvider);
      } else {
        void refreshCardsFromStoredCaptures(capturedProvider);
      }
    });
    return () => sub.remove();
  }, [pickupCoords, destinationCoords, rideType, carAc, capturedProvider]);

  useFocusEffect(
    useCallback(() => {
      void refreshCardsFromStoredCaptures();
    }, [refreshCardsFromStoredCaptures])
  );

  useEffect(() => {
    const auditSource =
      Array.isArray(estimateFares) && estimateFares.length ? estimateFares : incomingFares;
    const auditList = (Array.isArray(auditSource) ? auditSource : []).filter((item) =>
      isPakistanCompareProvider(item?.provider)
    );
    loggedEstimatesRef.current = new Map(
      auditList.map((item) => [
        normalizeProvider(item.provider).toLowerCase(),
        typeof item.fare === 'number' ? item.fare : Number(item.fare),
      ])
    );

    const filtered = baseFareList();
    let cancelled = false;
    (async () => {
      const captured = await getCapturedFaresForContext(
        pickupCoords,
        destinationCoords,
        rideType,
        carAc
      );
      if (cancelled) return;
      const merged = mergeCapturesIntoFares(filtered, captured);
      setFaresBase(applyYangoBykeaMinSpread(merged));
      const latest = pickLatestCapture(captured);
      if (latest && mountedRef.current) {
        const provider = normalizeProvider(latest.provider);
        const fare = typeof latest.fare === 'number' ? latest.fare : Number(latest.fare);
        if (provider && Number.isFinite(fare) && fare > 0) {
          setCapturedProvider(provider);
          setCapturedFare(fare);
          setCapturedFareText(latest.rawText || `${provider} PKR ${Math.round(fare)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [incomingFares, estimateFares, pickupCoords, destinationCoords, rideType, carAc, baseFareList]);

  const fareForRideLog = (rideOption) => {
    const key = normalizeProvider(rideOption?.provider).toLowerCase();
    const logged = loggedEstimatesRef.current.get(key);
    if (typeof logged === 'number' && Number.isFinite(logged)) return logged;
    if (rideOption?.fareSource === 'live_capture') return null;
    const fare = typeof rideOption?.fare === 'number' ? rideOption.fare : Number(rideOption?.fare);
    return Number.isFinite(fare) ? fare : null;
  };

  useEffect(() => {
    const { lat, lng } = coordsToLatLng(pickupCoords);
    let cancelled = false;
    (async () => {
      const items = await getHotspotItems(false);
      if (cancelled) return;
      setSurge(pickSurgeZone(lat, lng, items));
    })();
    return () => {
      cancelled = true;
    };
  }, [pickupCoords?.latitude, pickupCoords?.longitude]);

  useEffect(() => {
    const debouncer = captureDebouncerRef.current;
    const sub = subscribeToUiData((data) => {
      const provider = normalizeProvider(data?.provider);
      const fare = typeof data?.fare === 'number' ? data.fare : Number(data?.fare);
      const rawText = typeof data?.rawText === 'string' ? data.rawText.trim() : '';
      if (!provider || !isPakistanCompareProvider(provider) || !Number.isFinite(fare) || fare <= 0) return;

      debouncer.schedule({ provider, fare, rawText }, async (capture) => {
        const handoffId = activeHandoffIdRef.current;
        if (!handoffId) {
          pendingCaptureRef.current = {
            provider: capture.provider,
            fare: capture.fare,
          };
        }
        await applyLiveCaptureEvent(capture);

        if (!mountedRef.current) return;
        applyCaptureToCardState(capture);
      });
    });

    return () => {
      sub?.remove?.();
    };
  }, [pickupCoords, destinationCoords, rideType, carAc, applyCaptureToCardState]);

  const faresWithSurge = useMemo(() => {
    const list = Array.isArray(faresBase) ? faresBase : [];
    return list.map((item) => {
      const base = typeof item.fare === 'number' ? item.fare : Number(item.fare);
      const fare =
        item.fareSource === 'live_capture'
          ? base
          : applySurgeToFare(base, surge);
      return { ...item, fare };
    });
  }, [faresBase, surge]);

  const sortedFares = useMemo(() => {
    const list = Array.isArray(faresWithSurge) ? [...faresWithSurge] : [];
    if (sortBy === 'fare') return list.sort((a, b) => (a?.fare ?? 0) - (b?.fare ?? 0));
    return list.sort((a, b) => parseInt(a?.eta ?? '0', 10) - parseInt(b?.eta ?? '0', 10));
  }, [faresWithSurge, sortBy]);

  const surgeMultLabel = useMemo(() => {
    const m = surge.surgeMultiplier;
    if (!Number.isFinite(m) || m <= 1) return '1';
    return String(Math.round(m * 100) / 100);
  }, [surge.surgeMultiplier]);

  const surgePalette = surge.surgeLevel !== 'normal' ? getSurgeChipPalette(surge.surgeLevel) : null;
  const displayBaseFare =
    typeof bannerBaseFare === 'number' && Number.isFinite(bannerBaseFare)
      ? applySurgeToFare(bannerBaseFare, surge)
      : null;
  const surgeChipText =
    surge.zoneName && surge.surgeLevel !== 'normal'
      ? `⚡ ${surgeMultLabel}× surge — ${surge.zoneName} is busy`
      : surge.surgeLevel !== 'normal'
        ? `⚡ ${surgeMultLabel}× surge in this area`
        : null;
  const capturedFareSurged =
    capturedFare != null && Number.isFinite(capturedFare)
      ? applySurgeToFare(capturedFare, surge)
      : null;

  const rideHandoff = useMemo(
    () => ({ rideType, carAc: rideType === 'car' ? carAc : false }),
    [rideType, carAc]
  );

  const rideTypeSummary =
    rideType === 'car'
      ? `car (${carAc ? 'with AC' : 'no AC'})`
      : rideType;

  const toggleSort = () => setSortBy((v) => (v === 'fare' ? 'eta' : 'fare'));

  const goToRideHome = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'Rides' });
    }
  };

  const handleChange = () => {
    goToRideHome();
  };

  const logSelection = async (payload) => {
    try {
      const res = await farelyApi.post('/rides/provider-selection', payload);
      return res.data?.id || null;
    } catch (_) {
      return null;
    }
  };

  const recordHandoff = async (payload) => {
    try {
      const res = await farelyApi.post('/rides/ride-handoff', payload);
      return res.data?.id || null;
    } catch (_) {
      return null;
    }
  };

  const runOpenProvider = async (rideOption) => {
    const id = rideOption?.id;
    if (!id) return;

    if (routeReady === 'loading') {
      showAppToast({
        title: 'Preparing trip',
        body: 'Saving your route — try again in a moment.',
        tone: 'info',
      });
      return;
    }
    if (routeReady === 'failed') {
      showAppToast({
        title: 'Route not saved',
        body: 'Go back and run Compare again before opening a provider app.',
        tone: 'error',
      });
      return;
    }

    setBookingLoadingId(id);
    setBookingStatus('Opening provider app...');
    try {
      syncCaptureHandoffToNative(rideType, rideType === 'car' ? carAc : false);

      const loggedEstimateFare = fareForRideLog(rideOption);
      const plannedId = plannedHandoffIdRef.current;
      if (plannedId) {
        activeHandoffIdRef.current = plannedId;
        if (pickupCoords && destinationCoords) {
          await setActiveCaptureHandoff({
            handoffId: plannedId,
            provider: rideOption.provider,
            pickupCoords,
            destinationCoords,
            rideType,
            carAc: rideType === 'car' ? carAc : false,
          });
        }
      }

      const redirect = await redirectToProvider(
        rideOption.provider,
        pickupCoords,
        destinationCoords,
        rideHandoff
      );

      const selectionLogId = await logSelection({
        searchLogId,
        provider: rideOption.provider,
        rideType,
        carAc: rideType === 'car' ? carAc : false,
        estimatedFare: loggedEstimateFare,
        redirectAttempted: true,
        redirectSucceeded: redirect.success,
        redirectMode: redirect.mode,
        failureReason: redirect.reason || '',
      });

      const handoffId = await recordHandoff({
        ...buildRouteHandoffBody({
          searchLogId,
          pickup,
          destination,
          pickupCoords,
          destinationCoords,
          rideType,
          carAc,
          extra: {
            selectionLogId,
            plannedHandoffId: plannedId || undefined,
            provider: rideOption.provider,
            providerRideName: rideOption.name || rideOption.rideType || '',
            estimatedFare: loggedEstimateFare,
            redirectSucceeded: redirect.success,
            redirectMode: redirect.mode,
            failureReason: redirect.reason || '',
            openedUrl: redirect.openedUrl || '',
          },
        }),
      });

      const resolvedHandoffId = handoffId || plannedId;
      if (resolvedHandoffId) {
        activeHandoffIdRef.current = resolvedHandoffId;
        await flushPendingCapture(resolvedHandoffId, rideOption.provider);
      }

      if (handoffId && handoffId === plannedId) {
        plannedHandoffIdRef.current = null;
      }

      if (redirect.success && resolvedHandoffId) {
        const captureCtx = {
          handoffId: resolvedHandoffId,
          provider: rideOption.provider,
          pickupCoords,
          destinationCoords,
          rideType,
          carAc: rideType === 'car' ? carAc : false,
        };
        await setActiveCaptureHandoff(captureCtx);
        await setPendingRideConfirmation({
          ...captureCtx,
          providerRideName: rideOption.name || rideOption.rideType || '',
          estimatedFare: loggedEstimateFare,
          pickup,
          destination,
          createdAt: new Date().toISOString(),
        });
      }

      if (!mountedRef.current) return;
      pushAppNotification({
        type: 'ride',
        title: 'Redirected to provider',
        body: `Continue your booking in ${rideOption?.provider || 'provider app'}.`,
        meta: { rideId: rideOption?.id || null, provider: rideOption?.provider || '' },
      });
      setBookingStatus(redirect.success ? 'Opened provider app' : 'Could not open provider app');
      if (redirect.success && pickupCoords && destinationCoords) {
        const manualTitle = MANUAL_COORDS_ALERT_TITLE_BY_PROVIDER[rideOption.provider];
        if (manualTitle) {
          showAppToast({
            title: manualTitle,
            body: 'If prefill fails, use manual coordinates shown on this screen.',
            tone: 'info',
          });
        }
      }
      if (!redirect.success) {
        showAppToast({
          title: 'Could not open app',
          body: 'Please install the provider app and try again.',
          tone: 'error',
        });
      }
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Redirect failed';
      showAppToast({ title: 'Redirect failed', body: msg, tone: 'error' });
    } finally {
      if (mountedRef.current) setBookingLoadingId(null);
    }
  };

  const handleBook = async (rideOption) => {
    const id = rideOption?.id;
    if (!id || bookingLoadingId) return;

    if (rideOption.provider === 'Bykea') {
      setBykeaConfirmOption(rideOption);
      return;
    }

    await runOpenProvider(rideOption);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.backRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goToRideHome}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Back to ride map"
          >
            <FontAwesome6 name="chevron-left" size={14} color={colors.accent} solid />
            <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>Compare rides</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                {pickup} → {destination}
              </Text>
              {!!bookingStatus && (
                <Text style={[styles.bookingStatus, { color: colors.success }]}>{bookingStatus}</Text>
              )}
              {!!capturedFareText && (
                <Text style={[styles.liveFareStatus, { color: colors.accent }]}>
                  Live fare capture ({capturedProvider || 'provider'}):
                  {` PKR ${capturedFareSurged != null ? Math.round(capturedFareSurged) : '—'} · ${capturedFareText}`}
                </Text>
              )}
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Type: {rideTypeSummary} • Sort: {sortBy}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Estimates only — booking and final fare are set in Yango or Bykea.
              </Text>
              {!!surgePalette && surgeChipText && (
                <View
                  style={[
                    styles.surgeChip,
                    { backgroundColor: surgePalette.bg, borderColor: surgePalette.border },
                  ]}
                >
                  <Text style={[styles.surgeChipText, { color: surgePalette.fg }]}>{surgeChipText}</Text>
                </View>
              )}
              {displayBaseFare != null && (
                <View style={[styles.baseFareBanner, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}>
                  <Text style={[styles.baseFareLabel, { color: colors.textMuted }]}>Minimum base fare (estimate)</Text>
                  <Text style={[styles.baseFareValue, { color: colors.text }]}>
                    PKR {Math.round(displayBaseFare)}
                    {typeof routeDistanceKm === 'number' && Number.isFinite(routeDistanceKm)
                      ? ` · ${routeDistanceKm} km`
                      : ''}
                  </Text>
                  <Text style={[styles.baseFareHint, { color: colors.textMuted }]}>
                    Listed prices are this amount or higher.
                  </Text>
                  {bannerCalibrated ? (
                    <Text style={[styles.baseFareHint, { color: colors.textMuted, marginTop: 6 }]}>
                      Minimum includes calibration from saved Yango / Bykea prices for this route.
                    </Text>
                  ) : null}
                </View>
              )}
            </View>

            <View style={styles.headerBtns}>
              <TouchableOpacity
                style={[styles.sortBtn, { backgroundColor: colors.chipActive }]}
                onPress={toggleSort}
              >
                <Text style={[styles.sortBtnText, { color: colors.onAccent }]}>Sort</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.changeBtn, { backgroundColor: colors.accent }]}
                onPress={handleChange}
              >
                <Text style={[styles.changeBtnText, { color: colors.onAccent }]}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.infoBanner, { borderColor: colors.border, backgroundColor: colors.chipInactive }]}>
            <Text style={[styles.infoBannerTitle, { color: colors.textMuted }]}>Aggregator</Text>
            <Text style={[styles.meta, { color: colors.textSecondary, marginTop: 4 }]}>
              Farely does not process payments. Open Yango or Bykea only when you choose — one app at a time.
              Live fares update when you return after viewing the estimate screen.
            </Text>
          </View>
        </View>

        <FlatList
          data={sortedFares}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No rides found</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Go back and try a different pickup or destination.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <RideOptionCard
              item={item}
              bookingLoadingId={bookingLoadingId}
              openDisabled={routeReady === 'loading'}
              onOpenApp={handleBook}
              colors={colors}
              styles={styles}
            />
          )}
        />
      </View>
      {!!bykeaConfirmOption && (
        <View style={styles.confirmOverlay}>
          <TouchableOpacity
            style={styles.confirmBackdrop}
            activeOpacity={1}
            onPress={() => setBykeaConfirmOption(null)}
          />
          <View
            style={[
              styles.confirmCard,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
            ]}
          >
            <View style={[styles.confirmIconWrap, { backgroundColor: colors.accentSoft }]}>
              <Image source={getProviderLogo('Bykea')} style={styles.confirmBykeaLogo} resizeMode="contain" />
            </View>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Choose the correct ride type in Bykea
            </Text>
            <Text style={[styles.confirmBody, { color: colors.textSecondary }]}>
              Bykea cannot lock bike, rickshaw, or car from outside the app. After it opens, select the
              same vehicle type you chose in Farely so your estimate stays meaningful.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { borderColor: colors.borderStrong, backgroundColor: colors.chipInactive }]}
                onPress={() => setBykeaConfirmOption(null)}
              >
                <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmOpenBtn, { backgroundColor: colors.accent }]}
                onPress={() => {
                  const option = bykeaConfirmOption;
                  setBykeaConfirmOption(null);
                  if (option) {
                    void runOpenProvider(option);
                  }
                }}
              >
                <Text style={[styles.confirmOpenText, { color: colors.onAccent }]}>Open Bykea</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default RideOptionsScreen;

function createStyles() {
  return StyleSheet.create({
    safe: { flex: 1 },
    container: { flex: 1 },
    backRow: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 4,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingRight: 12,
    },
    backText: { fontSize: 16, fontWeight: '700' },
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      borderBottomWidth: 1,
    },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    headerText: { flex: 1 },
    title: { fontSize: 22, fontWeight: '800' },
    subtitle: { marginTop: 6, fontSize: 12 },
    bookingStatus: { marginTop: 8, fontSize: 12, fontWeight: '700' },
    liveFareStatus: { marginTop: 6, fontSize: 12, fontWeight: '800' },
    meta: { marginTop: 8, fontSize: 12, fontWeight: '600' },
    surgeChip: {
      marginTop: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
    },
    surgeChipText: { fontSize: 12, fontWeight: '800' },
    baseFareBanner: {
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
    },
    baseFareLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
    baseFareValue: { marginTop: 4, fontSize: 17, fontWeight: '900' },
    baseFareHint: { marginTop: 4, fontSize: 11, fontWeight: '600' },
    headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    infoBanner: {
      marginTop: 12,
      padding: 12,
      borderWidth: 1,
      borderRadius: 12,
    },
    infoBannerTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
    sortBtn: {
      minWidth: 58,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: 'center',
    },
    sortBtnText: { fontWeight: '800', fontSize: 12 },
    changeBtn: {
      minWidth: 74,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: 'center',
    },
    changeBtnText: { fontWeight: '800', fontSize: 12 },
    listContent: { padding: 16, paddingBottom: 24, gap: 12 },
    empty: { padding: 24, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '800' },
    emptyText: { marginTop: 8, fontSize: 12, textAlign: 'center' },
    card: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardLeft: { flex: 1 },
    providerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    providerLogo: { width: 28, height: 28, borderRadius: 6 },
    provider: { fontSize: 15, fontWeight: '900', flex: 1 },
    ride: { marginTop: 4, fontWeight: '700', fontSize: 12 },
    riderMeta: { marginTop: 2, fontWeight: '600', fontSize: 12 },
    cardRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
    price: { fontSize: 14, fontWeight: '900' },
    bookBtn: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      minWidth: 74,
      alignItems: 'center',
    },
    bookBtnDisabled: { opacity: 0.7 },
    bookBtnText: { fontWeight: '900', fontSize: 12 },
    confirmOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 30,
      elevation: 30,
      paddingHorizontal: 18,
    },
    confirmBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    confirmCard: {
      width: '100%',
      borderRadius: 18,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    confirmIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    confirmBykeaLogo: { width: 28, height: 28 },
    confirmTitle: { fontSize: 18, fontWeight: '900' },
    confirmBody: { marginTop: 8, fontSize: 13, lineHeight: 20, fontWeight: '600' },
    confirmActions: { marginTop: 14, flexDirection: 'row', gap: 10 },
    confirmCancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
    },
    confirmCancelText: { fontWeight: '800' },
    confirmOpenBtn: {
      flex: 1.2,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
    },
    confirmOpenText: { fontWeight: '900' },
  });
}
