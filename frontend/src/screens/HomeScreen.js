import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  Linking,
  Platform,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import farelyApi from '../api/farelyApi';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { pushAppNotification } from '../utils/notifications';
import { useTheme } from '../theme/ThemeContext';
import { createHomeStyles } from './homeThemeStyles';
import { showAppToast } from '../utils/appToast';
import { subscribeToUiData, syncCaptureHandoffToNative } from '../native/accessibilityBridge';
import {
  buildCaptureStorageKey,
  buildRouteFareKey,
  getCapturedFaresForContext,
  saveCapturedFare,
} from '../utils/liveFareStore';
import { applyYangoBykeaMinSpread } from '../utils/yangoBykeaFareSpread';
import { buildLiveCalibrationFromCaptures } from '../utils/liveCalibration';
import { createLiveCaptureDebouncer } from '../utils/liveCaptureDebounced';
import {
  getHotspotItems,
  pickSurgeZone,
  applySurgeToFare,
  NEUTRAL_SURGE,
  getSurgeChipPalette,
} from '../utils/surgeStore';

const normalizeProvider = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('yango') || v.includes('yandex')) return 'Yango';
  if (v.includes('bykea') || v.includes('bykia')) return 'Bykea';
  if (v.includes('indrive') || v.includes('in drive') || v.includes('in-drive')) return 'InDrive';
  return String(value || '').trim();
};

const TUK_TUK_PNG = require('../../assets/images/ride-types/tuktuk.png');

const RIDE_TYPE_OPTIONS = [
  { id: 'bike', kind: 'fa', icon: 'motorcycle', a11y: 'Bike' },
  { id: 'rickshaw', kind: 'image', source: TUK_TUK_PNG, a11y: 'Rickshaw' },
  { id: 'car', kind: 'fa', icon: 'car', a11y: 'Car' },
];
const RIDE_TYPE_ICON_SIZE = 22;
const PAKISTAN_BOUNDS = {
  minLat: 23.5,
  maxLat: 37.2,
  minLng: 60.8,
  maxLng: 77.9,
};

const PAKISTAN_POLYGON = [
  { latitude: 24.0, longitude: 61.0 },
  { latitude: 25.3, longitude: 61.2 },
  { latitude: 26.5, longitude: 61.5 },
  { latitude: 28.0, longitude: 62.0 },
  { latitude: 29.5, longitude: 62.0 },
  { latitude: 31.0, longitude: 63.0 },
  { latitude: 32.5, longitude: 63.8 },
  { latitude: 34.0, longitude: 65.2 },
  { latitude: 35.5, longitude: 66.8 },
  { latitude: 36.8, longitude: 69.5 },
  { latitude: 36.7, longitude: 72.0 },
  { latitude: 35.3, longitude: 73.8 },
  { latitude: 34.0, longitude: 74.9 },
  { latitude: 31.2, longitude: 74.6 },
  { latitude: 29.0, longitude: 71.8 },
  { latitude: 27.5, longitude: 69.5 },
  { latitude: 25.8, longitude: 67.8 },
  { latitude: 24.8, longitude: 66.6 },
  { latitude: 24.2, longitude: 64.5 },
  { latitude: 24.0, longitude: 61.0 },
];

function isInPakistan(latitude, longitude) {
  const inBounds =
    latitude >= PAKISTAN_BOUNDS.minLat
    && latitude <= PAKISTAN_BOUNDS.maxLat
    && longitude >= PAKISTAN_BOUNDS.minLng
    && longitude <= PAKISTAN_BOUNDS.maxLng;
  if (!inBounds) return false;

  let inside = false;
  for (let i = 0, j = PAKISTAN_POLYGON.length - 1; i < PAKISTAN_POLYGON.length; j = i++) {
    const yi = PAKISTAN_POLYGON[i].latitude;
    const xi = PAKISTAN_POLYGON[i].longitude;
    const yj = PAKISTAN_POLYGON[j].latitude;
    const xj = PAKISTAN_POLYGON[j].longitude;
    const intersect =
      yi > latitude !== yj > latitude
      && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function hasValidRouteEndpoints(pickupCoords, destinationCoords) {
  return (
    pickupCoords
    && destinationCoords
    && typeof pickupCoords.latitude === 'number'
    && typeof pickupCoords.longitude === 'number'
    && typeof destinationCoords.latitude === 'number'
    && typeof destinationCoords.longitude === 'number'
  );
}

const HomeScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const styles = useMemo(() => createHomeStyles(themeColors), [themeColors]);

  const [rideType, setRideType] = useState('car'); // rickshaw | bike | car
  /** When rideType is car: false = without AC, true = with AC (sent to compare + provider intents). */
  const [carWithAc, setCarWithAc] = useState(false);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectionMode, setSelectionMode] = useState('destination');
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [loading, setLoading] = useState(false);
  const [driverCoords, setDriverCoords] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');
  const [routeCoords, setRouteCoords] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationPromptMode, setLocationPromptMode] = useState('permission'); // permission | services
  const [fares, setFares] = useState([]);
  const [baseFareEstimate, setBaseFareEstimate] = useState(null);
  const [trafficSurge, setTrafficSurge] = useState(NEUTRAL_SURGE);
  const [compareDistanceKm, setCompareDistanceKm] = useState(null);
  const [rideOverlayOpen, setRideOverlayOpen] = useState(false);
  const [bookingLoadingId, setBookingLoadingId] = useState(null);
  const [minFareCalibrated, setMinFareCalibrated] = useState(false);
  // Keep map mounted; avoid remounting (expo-maps can freeze on remount).
  const driverMoveIntervalRef = useRef(null);
  const driverArriveTimeoutRef = useRef(null);
  const mapFocusTimeoutRef = useRef(null);
  const mapLoadEpochRef = useRef(0);
  const mapLoadedEpochRef = useRef(0);
  const sheetDragStartRef = useRef(0);
  const hasResults = false;

  const { height: screenHeight } = Dimensions.get('window');
  const SHEET_HEIGHT = Math.floor(screenHeight * 0.88);
  const SHEET_RESULTS = 0;
  const SHEET_EXPANDED = Math.floor(screenHeight * 0.16);
  const SHEET_COLLAPSED = Math.floor(screenHeight * 0.42);
  const sheetTranslateY = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const locationBannerY = useRef(new Animated.Value(-22)).current;
  const locationBannerOpacity = useRef(new Animated.Value(0)).current;
  const minFareRefreshSeq = useRef(0);
  const homeCaptureDebouncerRef = useRef(null);
  if (!homeCaptureDebouncerRef.current) {
    homeCaptureDebouncerRef.current = createLiveCaptureDebouncer(500);
  }

  const animateSheetTo = (toValue) => {
    Animated.spring(sheetTranslateY, {
      toValue,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.7,
    }).start();
  };

  const resetBookingSimulation = () => {
    if (driverMoveIntervalRef.current) clearInterval(driverMoveIntervalRef.current);
    if (driverArriveTimeoutRef.current) clearTimeout(driverArriveTimeoutRef.current);
    driverMoveIntervalRef.current = null;
    driverArriveTimeoutRef.current = null;
    setDriverCoords(null);
    setBookingStatus('');
  };

  useEffect(() => {
    if (showLocationPrompt) {
      Animated.parallel([
        Animated.timing(locationBannerOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(locationBannerY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          stiffness: 180,
        }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(locationBannerOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(locationBannerY, {
        toValue: -22,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showLocationPrompt, locationBannerOpacity, locationBannerY]);

  useEffect(() => () => resetBookingSimulation(), []);

  // Refs hold latest deps so the focus/blur listeners stay registered ONCE and don't
  // re-attach on every pickup/destination change (re-attaching ran cleanup → onBlur()
  // → setMapReady(false), which made the map loader flash every time the user pinned
  // a new point and looked like a continuous "Refreshing..." cycle).
  const refreshMinFareEstimateRef = useRef(refreshMinFareEstimate);
  refreshMinFareEstimateRef.current = refreshMinFareEstimate;
  const pickupCoordsRef = useRef(pickupCoords);
  pickupCoordsRef.current = pickupCoords;
  const destinationCoordsRef = useRef(destinationCoords);
  destinationCoordsRef.current = destinationCoords;
  const locatingRef = useRef(locating);
  locatingRef.current = locating;

  useEffect(() => {
    const onFocus = () => {
      if (hasValidRouteEndpoints(pickupCoordsRef.current, destinationCoordsRef.current)) {
        void refreshMinFareEstimateRef.current();
      }

      // When returning from RideOptions, expo-maps can briefly show a blank/blue state
      // while tiles/camera settle. Force loader overlay until onMapLoaded (or fallback).
      if (locatingRef.current) return;
      mapLoadEpochRef.current += 1;
      setMapReady(false);
      if (mapFocusTimeoutRef.current) clearTimeout(mapFocusTimeoutRef.current);
      mapFocusTimeoutRef.current = setTimeout(() => {
        setMapReady(true);
      }, 2000);
    };

    const onBlur = () => {
      if (mapFocusTimeoutRef.current) clearTimeout(mapFocusTimeoutRef.current);
      mapFocusTimeoutRef.current = null;
      setMapReady(false);
    };

    const unsubFocus = navigation.addListener('focus', onFocus);
    const unsubBlur = navigation.addListener('blur', onBlur);
    return () => {
      unsubFocus();
      unsubBlur();
      if (mapFocusTimeoutRef.current) clearTimeout(mapFocusTimeoutRef.current);
      mapFocusTimeoutRef.current = null;
    };
  }, [navigation]);

  useEffect(() => {
    animateSheetTo(SHEET_COLLAPSED);
  }, []);

  useEffect(() => {
    syncCaptureHandoffToNative(rideType, rideType === 'car' ? carWithAc : false);
  }, [rideType, carWithAc]);

  useEffect(() => {
    const booked = route?.params?.booked;
    if (!booked) return;

    const driverLocation = booked?.driverLocation;
    if (driverLocation?.latitude && driverLocation?.longitude) {
      setDriverCoords(driverLocation);
    }
    if (booked?.status) setBookingStatus(booked.status);

    navigation.setParams({ booked: undefined });
  }, [navigation, route?.params]);

  useEffect(() => {
    const selection = route?.params?.locationSelection;
    if (!selection) return;

    if (selection.pickup) setPickup(selection.pickup);
    if (selection.destination) setDestination(selection.destination);
    if (selection.pickupCoords) setPickupCoords(selection.pickupCoords);
    if (selection.destinationCoords) setDestinationCoords(selection.destinationCoords);

    if (selection.pickupCoords?.latitude && selection.pickupCoords?.longitude) {
      setCurrentLocation(selection.pickupCoords);
    }

    if (typeof selection.baseFareEstimate === 'number' && Number.isFinite(selection.baseFareEstimate)) {
      setBaseFareEstimate(selection.baseFareEstimate);
    }
    if (typeof selection.distanceKmEstimate === 'number' && Number.isFinite(selection.distanceKmEstimate)) {
      setCompareDistanceKm(selection.distanceKmEstimate);
    }
    if (typeof selection.minFareCalibrated === 'boolean') {
      setMinFareCalibrated(selection.minFareCalibrated);
    }

    navigation.setParams({ locationSelection: undefined });
  }, [navigation, route?.params?.locationSelection]);

  const refreshMinFareEstimate = useCallback(async () => {
    if (!hasValidRouteEndpoints(pickupCoords, destinationCoords)) {
      setBaseFareEstimate(null);
      setCompareDistanceKm(null);
      setMinFareCalibrated(false);
      return;
    }

    const reqId = ++minFareRefreshSeq.current;
    try {
      const captured = await getCapturedFaresForContext(
        pickupCoords,
        destinationCoords,
        rideType,
        carWithAc
      );
      const liveCalibration = buildLiveCalibrationFromCaptures(captured);

      const res = await farelyApi.post('/rides/estimate-min', {
        pickupLat: pickupCoords.latitude,
        pickupLng: pickupCoords.longitude,
        destinationLat: destinationCoords.latitude,
        destinationLng: destinationCoords.longitude,
        rideType,
        carAc: rideType === 'car' ? carWithAc : false,
        ...(liveCalibration.length ? { liveCalibration } : {}),
      });
      if (reqId !== minFareRefreshSeq.current) return;
      const d = res.data || {};
      if (typeof d.baseFare === 'number' && Number.isFinite(d.baseFare)) {
        setBaseFareEstimate(d.baseFare);
      }
      if (typeof d.distanceKm === 'number' && Number.isFinite(d.distanceKm)) {
        setCompareDistanceKm(d.distanceKm);
      }
      setMinFareCalibrated(Boolean(d.calibratedFromScrapes));
    } catch (_) {
      // Keep the last estimate (e.g. from LocationSearch) on transient errors.
    }
  }, [pickupCoords, destinationCoords, rideType, carWithAc]);

  // Debounce so rapid coord changes (map drag, GPS jitter, ride-type toggle) coalesce
  // into a single backend call instead of one per re-render.
  useEffect(() => {
    const handle = setTimeout(() => {
      void refreshMinFareEstimate();
    }, 350);
    return () => clearTimeout(handle);
  }, [refreshMinFareEstimate]);

  useEffect(() => {
    const debouncer = homeCaptureDebouncerRef.current;
    const sub = subscribeToUiData((data) => {
      const provider = normalizeProvider(data?.provider);
      const fare = typeof data?.fare === 'number' ? data.fare : Number(data?.fare);
      const rawText = typeof data?.rawText === 'string' ? data.rawText.trim() : '';
      const key = buildCaptureStorageKey(pickupCoords, destinationCoords, rideType, carWithAc);
      if (!key || !provider || !Number.isFinite(fare) || fare <= 0) return;

      debouncer.schedule({ provider, fare, rawText }, async () => {
        await saveCapturedFare(key, provider, fare, rawText);
        await refreshMinFareEstimate();
      });
    });
    return () => {
      sub?.remove?.();
      debouncer?.clear?.();
    };
  }, [pickupCoords, destinationCoords, rideType, carWithAc, refreshMinFareEstimate]);

  useEffect(() => {
    const lat = pickupCoords?.latitude;
    const lng = pickupCoords?.longitude;
    let cancelled = false;
    (async () => {
      const items = await getHotspotItems(false);
      if (cancelled) return;
      setTrafficSurge(pickSurgeZone(lat, lng, items));
    })();
    return () => {
      cancelled = true;
    };
  }, [pickupCoords?.latitude, pickupCoords?.longitude]);

  useEffect(() => {
    if (!hasValidRouteEndpoints(pickupCoords, destinationCoords)) {
      setRouteCoords([]);
      return;
    }

    let cancelled = false;

    const fetchRoute = async () => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/`
          + `${pickupCoords.longitude},${pickupCoords.latitude};`
          + `${destinationCoords.longitude},${destinationCoords.latitude}`
          + `?overview=full&geometries=geojson`;

        const res = await fetch(url);
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates || [];

        if (cancelled || !Array.isArray(coords) || coords.length < 2) {
          if (!cancelled) setRouteCoords([]);
          return;
        }

        const mapped = coords
          .filter((c) => Array.isArray(c) && c.length >= 2)
          .map((c) => ({ latitude: c[1], longitude: c[0] }));

        if (!cancelled) {
          setRouteCoords(mapped);
        }
      } catch (_) {
        if (!cancelled) setRouteCoords([]);
      }
    };

    fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [pickupCoords, destinationCoords]);

  useEffect(() => {
    if (locating) {
      setMapReady(false);
      return;
    }
    // Fallback in case onMapLoaded event is delayed/not fired.
    const t = setTimeout(() => setMapReady(true), 1200);
    return () => clearTimeout(t);
  }, [locating]);

  const openLocationSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        // Open device location settings directly on Android.
        await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
        return;
      }
      await Linking.openSettings();
    } catch (_) {
      showAppToast({
        title: 'Open settings',
        body: 'Please open device settings and enable location.',
        tone: 'error',
      });
    }
  };

  const requestAndLoadLocation = async ({ askPermission }) => {
    setLocating(true);
    try {
      setLocationError('');

      const permissionResult = askPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();

      if (permissionResult.status !== 'granted') {
        setLocationPromptMode('permission');
        setShowLocationPrompt(true);
        setLocationError('Location permission is required to use nearby rides.');
        return false;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationPromptMode('services');
        setShowLocationPrompt(true);
        setLocationError('Location services are off. Enable GPS/Location to continue.');
        return false;
      }

      if (Platform.OS === 'android') {
        await Location.enableNetworkProviderAsync().catch(() => null);
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
        timeInterval: 1000,
        distanceInterval: 1,
      });

      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      setCurrentLocation(coords);
      setShowLocationPrompt(false);

      if (!pickupCoords) {
        setPickupCoords(coords);
        const geocode = await Location.reverseGeocodeAsync(coords).catch(() => null);
        const place = geocode?.[0];
        const fallback = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        const label = place ? [place.name, place.street, place.city].filter(Boolean).join(', ') : '';
        setPickup(label || fallback);
        setSelectionMode('destination');
      }

      return true;
    } catch (_) {
      setLocationError('Could not fetch current location. Please try again.');
      setLocationPromptMode('services');
      setShowLocationPrompt(true);
      return false;
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    requestAndLoadLocation({ askPermission: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocateMe = async () => {
    const ok = await requestAndLoadLocation({ askPermission: true });
    if (ok) setSelectionMode('destination');
  };

  const setAddressFromCoords = async (coords, target) => {
    try {
      // If pickup/destination changes, clear any previous booking simulation.
      resetBookingSimulation();
      setBaseFareEstimate(null);
      setCompareDistanceKm(null);
      const geocode = await Location.reverseGeocodeAsync(coords);
      const place = geocode?.[0];
      const label = place
        ? [place.name, place.street, place.city, place.region].filter(Boolean).join(', ')
        : `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;

      if (target === 'pickup') {
        setPickupCoords(coords);
        setPickup(label);
        setSelectionMode('destination');
      } else {
        setDestinationCoords(coords);
        setDestination(label);
      }
    } catch (_) {
      const fallback = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      if (target === 'pickup') {
        setPickupCoords(coords);
        setPickup(fallback);
        setSelectionMode('destination');
      } else {
        setDestinationCoords(coords);
        setDestination(fallback);
      }
    }
  };

  const handleMapPress = async (event) => {
    // expo-maps `onMapClick` gives: { coordinates: { latitude, longitude } }
    // Some platforms may wrap under nativeEvent.
    const coordsObj = event?.coordinates ?? event?.nativeEvent?.coordinates;

    // Support both {latitude, longitude} and [{latitude, longitude}] shapes.
    const first = Array.isArray(coordsObj) ? coordsObj[0] : coordsObj;
    if (!first || typeof first.latitude !== 'number' || typeof first.longitude !== 'number') return;
    if (!isInPakistan(first.latitude, first.longitude)) {
      showAppToast({
        title: 'Outside service area',
        body: 'Please select pickup and destination within Pakistan.',
        tone: 'error',
      });
      return;
    }

    await setAddressFromCoords({ latitude: first.latitude, longitude: first.longitude }, selectionMode);
  };

  const handleCompare = async () => {
    // Fetch ride options and open full-screen RideOptions screen.
    if (!pickup || !destination) return alert('Enter pickup and destination first.');
    if (!pickupCoords || !destinationCoords) return alert('Tap the map to set both locations.');

    setLoading(true);
    setBookingStatus('');
    try {
      const routeFareKey = buildRouteFareKey(pickupCoords, destinationCoords);
      const captured = await getCapturedFaresForContext(
        pickupCoords,
        destinationCoords,
        rideType,
        carWithAc
      );
      const payload = { pickup, destination, rideType, carAc: rideType === 'car' ? carWithAc : false };
      payload.pickupLat = pickupCoords.latitude;
      payload.pickupLng = pickupCoords.longitude;
      payload.destinationLat = destinationCoords.latitude;
      payload.destinationLng = destinationCoords.longitude;

      // Compare uses model estimates; live scrapes merge into cards from this route's storage only.
      const res = await farelyApi.post('/rides/compare', payload);
      const raw = res.data;
      const baseFareEarly = Array.isArray(raw) ? null : raw?.baseFare;
      const distKmEarly = Array.isArray(raw) ? null : raw?.distanceKm;
      const list = Array.isArray(raw) ? raw : raw?.comparisons || [];
      const estimateOnlyFares = applyYangoBykeaMinSpread(
        list.filter((item) => {
          const p = normalizeProvider(item?.provider).toLowerCase();
          return p === 'yango' || p === 'bykea';
        })
      );
      const mergedFromApi = list.map((item) => {
        const itemProvider = normalizeProvider(item?.provider);
        const match = captured.find(
          (it) => normalizeProvider(it.provider).toLowerCase() === itemProvider.toLowerCase()
        );
        if (!match || !Number.isFinite(match.fare)) return item;
        return {
          ...item,
          fare: match.fare,
          estimateConfidence: 1,
          fareSource: 'live_capture',
        };
      });
      const seenProviders = new Set(
        mergedFromApi.map((item) => normalizeProvider(item?.provider).toLowerCase()).filter(Boolean)
      );
      const merged = [...mergedFromApi];
      for (const cap of captured) {
        const p = normalizeProvider(cap.provider);
        if (p !== 'Yango' && p !== 'Bykea') continue;
        if (!Number.isFinite(cap.fare) || cap.fare <= 0) continue;
        const key = p.toLowerCase();
        if (seenProviders.has(key)) continue;
        seenProviders.add(key);
        merged.push({
          id: `live_capture_${key}_${routeFareKey.replace(/[^a-z0-9]+/gi, '_').slice(0, 32)}`,
          provider: p,
          name: `${p} (live)`,
          fare: cap.fare,
          eta: '—',
          rideType,
          carAc: rideType === 'car' ? carWithAc : false,
          distanceKm: typeof distKmEarly === 'number' ? distKmEarly : undefined,
          estimateConfidence: 1,
          fareSource: 'live_capture',
          isEstimate: false,
        });
      }
      const mergedSpread = applyYangoBykeaMinSpread(merged);
      const baseFare = baseFareEarly;
      const distKm = distKmEarly;
      if (typeof baseFare === 'number' && Number.isFinite(baseFare)) {
        setBaseFareEstimate(baseFare);
      } else {
        setBaseFareEstimate(null);
      }
      if (typeof distKm === 'number' && Number.isFinite(distKm)) {
        setCompareDistanceKm(distKm);
      } else {
        setCompareDistanceKm(null);
      }
      setMinFareCalibrated(Boolean(raw?.calibratedFromScrapes));
      pushAppNotification({
        type: 'ride',
        title: 'Ride options updated',
        body: `${mergedSpread.length} ride option${mergedSpread.length === 1 ? '' : 's'} found for your route.`,
        meta: { pickup, destination, count: mergedSpread.length },
      });
      navigation.navigate('RideOptions', {
        pickup,
        destination,
        rideType,
        carAc: rideType === 'car' ? carWithAc : false,
        fares: mergedSpread,
        estimateFares: estimateOnlyFares,
        baseFare: typeof baseFare === 'number' ? baseFare : undefined,
        distanceKm: typeof distKm === 'number' ? distKm : undefined,
        searchLogId: Array.isArray(raw) ? undefined : raw?.searchLogId,
        pickupCoords,
        destinationCoords,
        capturedLiveFares: captured,
        compareCalibrated: Boolean(raw?.calibratedFromScrapes),
      });
    } catch (err) {
      alert(err.response?.data?.msg || err.response?.data?.message || 'Failed to get ride options');
    } finally {
      setLoading(false);
    }
  };

  const resetRideOverlay = () => {
    setRideOverlayOpen(false);
    setFares([]);
    setBookingLoadingId(null);
    setBookingStatus('');
  };

  const handleBookInline = async (rideOption) => {
    const id = rideOption?.id;
    if (!id || bookingLoadingId) return;

    setBookingLoadingId(id);
    setBookingStatus('Assigning driver...');

    try {
      const res = await farelyApi.post('/rides/compare', { rideId: id, action: 'book' });
      const { driver, driverLocation, status } = res.data || {};

      setBookingStatus(status || 'Driver Assigned');

      navigation.navigate('Chat', {
        booking: { driver, driverLocation, status: status || 'Driver Assigned' },
        rideOption,
        pickup,
        destination,
      });
    } catch (err) {
      alert(err.response?.data?.msg || err.response?.data?.message || 'Booking failed');
    } finally {
      setBookingLoadingId(null);
    }
  };

  const homeSurgePalette =
    trafficSurge.surgeLevel !== 'normal' ? getSurgeChipPalette(trafficSurge.surgeLevel) : null;
  const homeSurgeMult =
    Number.isFinite(trafficSurge.surgeMultiplier) && trafficSurge.surgeMultiplier > 1
      ? String(Math.round(trafficSurge.surgeMultiplier * 100) / 100)
      : '1';
  const homeSurgeChipText =
    trafficSurge.zoneName && trafficSurge.surgeLevel !== 'normal'
      ? `⚡ ${homeSurgeMult}× surge — ${trafficSurge.zoneName} is busy`
      : trafficSurge.surgeLevel !== 'normal'
        ? `⚡ ${homeSurgeMult}× surge in this area`
        : null;
  const displayHomeBaseFare =
    typeof baseFareEstimate === 'number' && Number.isFinite(baseFareEstimate)
      ? applySurgeToFare(baseFareEstimate, trafficSurge)
      : null;

  // Keep map mounted; show loader until ready.
  const mapDisabled = false;
  const showMapLoader = locating || !mapReady;

  const clampSheetY = (y) => {
    return Math.max(SHEET_RESULTS, Math.min(SHEET_COLLAPSED, y));
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((value) => {
          sheetDragStartRef.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const next = clampSheetY(sheetDragStartRef.current + gesture.dy);
        sheetTranslateY.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const projected = clampSheetY(sheetDragStartRef.current + gesture.dy + gesture.vy * 30);
        const anchors = [SHEET_EXPANDED, SHEET_COLLAPSED];
        let snapTo = anchors[0];
        let minDiff = Math.abs(projected - anchors[0]);
        for (let i = 1; i < anchors.length; i += 1) {
          const diff = Math.abs(projected - anchors[i]);
          if (diff < minDiff) {
            minDiff = diff;
            snapTo = anchors[i];
          }
        }
        animateSheetTo(snapTo);
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.mapFull} pointerEvents={mapDisabled ? 'none' : 'auto'}>
        {locating ? (
          <View style={styles.loadingMap}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Getting your current location...</Text>
          </View>
        ) : (
          <>
            {Platform.OS === 'android' ? (
              <GoogleMaps.View
                style={styles.map}
                onMapLoaded={() => {
                  mapLoadedEpochRef.current = mapLoadEpochRef.current;
                  setMapReady(true);
                }}
                onMapClick={handleMapPress}
                cameraPosition={{
                  center: currentLocation || { latitude: 24.8607, longitude: 67.0011 },
                  zoom: 14,
                }}
                userLocation={
                  currentLocation
                    ? { coordinates: currentLocation, followUserLocation: true }
                    : undefined
                }
                markers={[
                  ...(pickupCoords
                    ? [{ id: 'pickup', coordinates: pickupCoords, title: 'Pickup' }]
                    : []),
                  ...(destinationCoords
                    ? [{ id: 'destination', coordinates: destinationCoords, title: 'Destination' }]
                    : []),
                  ...(driverCoords
                    ? [{ id: 'driver', coordinates: driverCoords, title: 'Driver' }]
                    : []),
                ]}
                polylines={
                  routeCoords.length > 1
                    ? [
                        {
                          id: 'route',
                          coordinates: routeCoords,
                          color: themeColors.accent,
                          width: 5,
                          geodesic: true,
                        },
                      ]
                    : []
                }
              />
            ) : (
              <AppleMaps.View
                style={styles.map}
                onMapLoaded={() => {
                  mapLoadedEpochRef.current = mapLoadEpochRef.current;
                  setMapReady(true);
                }}
                onMapClick={handleMapPress}
                cameraPosition={{
                  center: currentLocation || { latitude: 24.8607, longitude: 67.0011 },
                  zoom: 14,
                }}
                markers={[
                  ...(pickupCoords
                    ? [{ id: 'pickup', coordinates: pickupCoords, title: 'Pickup' }]
                    : []),
                  ...(destinationCoords
                    ? [{ id: 'destination', coordinates: destinationCoords, title: 'Destination' }]
                    : []),
                  ...(driverCoords
                    ? [{ id: 'driver', coordinates: driverCoords, title: 'Driver' }]
                    : []),
                ]}
                polylines={
                  routeCoords.length > 1
                    ? [
                        {
                          id: 'route',
                          coordinates: routeCoords,
                          color: themeColors.accent,
                          width: 5,
                        },
                      ]
                    : []
                }
              />
            )}
          </>
        )}
      </View>
      {showMapLoader && (
        <View style={styles.mapLoaderOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={themeColors.accent} />
          <Text style={styles.mapLoaderText}>Loading map...</Text>
        </View>
      )}
      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.topBarMenuBtn}
          onPress={() => navigation.navigate('Menu')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Menu"
        >
          <FontAwesome6 name="bars" size={18} color={themeColors.onAccent} solid />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topBarBellBtn}
          onPress={() => navigation.navigate('Notification')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <FontAwesome6 name="bell" size={18} color={themeColors.textSecondary} regular />
          </TouchableOpacity>
      </View>
      {showLocationPrompt && (
        <Animated.View
          style={[
            styles.locationBannerWrap,
            { opacity: locationBannerOpacity, transform: [{ translateY: locationBannerY }] },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[
              styles.locationBanner,
              {
                backgroundColor: '#f4c542',
                borderColor: '#d8a917',
              },
            ]}
            onPress={handleLocateMe}
            activeOpacity={0.92}
          >
            <Text style={[styles.locationBannerTitle, { color: '#1f1f1f' }]}>
              We couldn't find you
            </Text>
            <Text style={[styles.locationBannerSubtitle, { color: '#2f2f2f' }]}>
              {locationPromptMode === 'services' ? 'Tap to turn on location services' : 'Tap to enable location'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: sheetTranslateY }] },
        ]}
        pointerEvents="auto"
      >
        <View style={styles.sheetHandleArea} {...sheetPanResponder.panHandlers}>
          <View style={styles.sheetHandle} />
        </View>
        {!!locationError && <Text style={styles.locationError}>{locationError}</Text>}

        <>
            <View style={styles.whereCard}>
              <TouchableOpacity
                style={styles.whereSearchRow}
                onPress={() =>
                  navigation.navigate('LocationSearch', {
                    pickup,
                    destination,
                    pickupCoords,
                    destinationCoords,
                    currentLocation,
                    rideType,
                    carAc: rideType === 'car' ? carWithAc : false,
                  })
                }
                activeOpacity={0.85}
              >
                <FontAwesome6 name="magnifying-glass" size={16} color={themeColors.accent} solid />
                <Text style={[styles.whereSearchText, destination ? styles.whereSearchTextActive : null]}>
                  {destination || 'Where would you go?'}
                </Text>
                <FontAwesome6 name="heart" size={16} color={themeColors.textMuted} regular />
              </TouchableOpacity>

              <View style={styles.rideTypeRow}>
                {RIDE_TYPE_OPTIONS.map((t) => {
                  const selected = rideType === t.id;
                  const color = selected ? themeColors.onAccent : themeColors.textSecondary;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      accessibilityRole="button"
                      accessibilityLabel={t.a11y}
                      accessibilityState={{ selected }}
                      style={[styles.rideTypeChip, selected && styles.rideTypeChipActive]}
                      onPress={() => {
                        setRideType(t.id);
                        if (t.id !== 'car') setCarWithAc(false);
                      }}
                    >
                      {t.kind === 'image' ? (
                        <Image
                          source={t.source}
                          style={[styles.rideTypeRaster, selected ? styles.rideTypeRasterActive : null]}
                          resizeMode="contain"
                        />
                      ) : selected ? (
                        <FontAwesome6 name={t.icon} size={RIDE_TYPE_ICON_SIZE} color={color} solid />
                      ) : (
                        <FontAwesome6 name={t.icon} size={RIDE_TYPE_ICON_SIZE} color={color} regular />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {rideType === 'car' && (
                <View style={styles.carAcRow}>
                  <TouchableOpacity
                    style={[styles.carAcChip, !carWithAc && styles.carAcChipActive]}
                    onPress={() => setCarWithAc(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Car without air conditioning"
                  >
                    <Text style={[styles.carAcChipText, !carWithAc && styles.carAcChipTextActive]}>No AC</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.carAcChip, carWithAc && styles.carAcChipActive]}
                    onPress={() => setCarWithAc(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Car with air conditioning"
                  >
                    <Text style={[styles.carAcChipText, carWithAc && styles.carAcChipTextActive]}>With AC</Text>
                  </TouchableOpacity>
                </View>
              )}
      </View>

            <Text style={styles.tipText}>Tap on the map to set destination.</Text>
            {displayHomeBaseFare != null && (
              <>
                {!!homeSurgePalette && homeSurgeChipText && (
                  <View
                    style={[
                      styles.trafficSurgeChip,
                      { backgroundColor: homeSurgePalette.bg, borderColor: homeSurgePalette.border },
                    ]}
                  >
                    <Text style={[styles.trafficSurgeChipText, { color: homeSurgePalette.fg }]}>
                      {homeSurgeChipText}
                    </Text>
                  </View>
                )}
                <View style={styles.baseFareBanner}>
                <Text style={styles.baseFareLabel}>Minimum fare (estimate)</Text>
                <Text style={styles.baseFareValue}>
                  PKR {Math.round(displayHomeBaseFare)}
                  {typeof compareDistanceKm === 'number' ? ` · ${compareDistanceKm} km` : ''}
                </Text>
                <Text style={styles.baseFareHint}>Provider fares are this amount or higher.</Text>
                {minFareCalibrated ? (
                  <Text style={[styles.baseFareHint, { marginTop: 6 }]}>
                    Tuned using saved Yango / Bykea prices for this route (see Compare fares for rows).
                  </Text>
                ) : null}
              </View>
              </>
            )}
            <TouchableOpacity style={styles.compareBtn} onPress={handleCompare} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color={themeColors.onAccent} /> : <Text style={styles.compareBtnText}>Compare fares</Text>}
            </TouchableOpacity>
      <Text style={styles.disclaimer}>* Farely only provides estimates. Booking and final fare happen in provider apps.</Text>
        </>

        {rideOverlayOpen && (
          <View style={styles.rideOverlayCover} pointerEvents="auto">
            <View style={styles.rideOverlayCard}>
              <View style={styles.rideOverlayHeader}>
                <Text style={styles.rideOverlayTitle}>Ride options</Text>
                <TouchableOpacity onPress={resetRideOverlay} style={styles.rideOverlayChangeBtn}>
                  <Text style={styles.rideOverlayChangeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>

      <FlatList
        data={fares}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.rideOverlayListContent}
                ListEmptyComponent={<Text style={styles.emptyText}>No rides found</Text>}
                renderItem={({ item }) => {
                  const isBooking = bookingLoadingId === item.id;
                  return (
                    <View style={styles.fareCard} key={item.id}>
            <View>
              <Text style={styles.providerName}>{item.provider}</Text>
                        <Text style={styles.rideTypeLine}>
                          {(item.name || item.rideType)} • {item.eta} •{' '}
                          {typeof item.distanceKm === 'number' ? `${item.distanceKm} km` : '—'}
                        </Text>
                        {!!item.rider?.name && <Text style={styles.riderText}>Rider: {item.rider.name}</Text>}
                        {!!item.rider?.phone && <Text style={styles.riderMetaText}>Phone: {item.rider.phone}</Text>}
                        {!!item.rider?.numberPlate && (
                          <Text style={styles.riderMetaText}>Car No: {item.rider.numberPlate}</Text>
                        )}
            </View>

            <View style={styles.priceContainer}>
                        <Text style={styles.price}>PKR {Math.round(item.fare)}</Text>
                        <TouchableOpacity
                          style={[styles.bookBtn, isBooking ? styles.bookBtnDisabled : null]}
                          onPress={() => handleBookInline(item)}
                          disabled={!!bookingLoadingId}
                        >
                          {isBooking ? (
                            <ActivityIndicator size="small" color={themeColors.onAccent} />
                          ) : (
                <Text style={styles.bookBtnText}>Book</Text>
                          )}
              </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />

              {!!bookingStatus && <Text style={styles.bookingStatus}>{bookingStatus}</Text>}
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

export default HomeScreen;
