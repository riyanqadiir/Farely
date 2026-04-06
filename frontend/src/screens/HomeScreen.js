import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  FlatList,
  Modal,
  Linking,
  Alert,
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

const TUK_TUK_PNG = require('../../assets/images/ride-types/tuktuk.png');

const RIDE_TYPE_OPTIONS = [
  { id: 'bike', kind: 'fa', icon: 'motorcycle', a11y: 'Bike' },
  { id: 'rickshaw', kind: 'image', source: TUK_TUK_PNG, a11y: 'Rickshaw' },
  { id: 'car', kind: 'fa', icon: 'car', a11y: 'Car' },
];
const RIDE_TYPE_ICON_SIZE = 22;

const HomeScreen = ({ navigation, route }) => {
  const [rideType, setRideType] = useState('car'); // rickshaw | bike | car
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
  const [compareDistanceKm, setCompareDistanceKm] = useState(null);
  const [rideOverlayOpen, setRideOverlayOpen] = useState(false);
  const [bookingLoadingId, setBookingLoadingId] = useState(null);
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

  useEffect(() => () => resetBookingSimulation(), []);

  useEffect(() => {
    const onFocus = () => {
      // When returning from RideOptions, expo-maps can briefly show a blank/blue state
      // while tiles/camera settle. Force loader overlay until onMapLoaded (or fallback).
      if (locating) return;
      mapLoadEpochRef.current += 1;
      setMapReady(false);
      if (mapFocusTimeoutRef.current) clearTimeout(mapFocusTimeoutRef.current);
      mapFocusTimeoutRef.current = setTimeout(() => {
        // Safety fallback in case onMapLoaded doesn't fire on some devices.
        setMapReady(true);
      }, 2000);
    };

    const onBlur = () => {
      if (mapFocusTimeoutRef.current) clearTimeout(mapFocusTimeoutRef.current);
      mapFocusTimeoutRef.current = null;
      // Next time we come back, always show loader first.
      setMapReady(false);
    };

    const unsubFocus = navigation.addListener('focus', onFocus);
    const unsubBlur = navigation.addListener('blur', onBlur);
    return () => {
      unsubFocus();
      unsubBlur();
      onBlur();
    };
  }, [navigation, locating]);

  useEffect(() => {
    animateSheetTo(SHEET_COLLAPSED);
  }, []);

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

    navigation.setParams({ locationSelection: undefined });
  }, [navigation, route?.params?.locationSelection]);

  // When ride type changes, recompute minimum fare for the same route (same coords, new pricing tier).
  const prevRideTypeRef = useRef(rideType);
  useEffect(() => {
    const rideTypeChanged = prevRideTypeRef.current !== rideType;
    if (rideTypeChanged) {
      prevRideTypeRef.current = rideType;
    }
    if (!rideTypeChanged) {
      return;
    }

    const hasEndpoints =
      pickupCoords
      && destinationCoords
      && typeof pickupCoords.latitude === 'number'
      && typeof pickupCoords.longitude === 'number'
      && typeof destinationCoords.latitude === 'number'
      && typeof destinationCoords.longitude === 'number';

    if (!hasEndpoints) {
      setBaseFareEstimate(null);
      setCompareDistanceKm(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await farelyApi.post('/rides/estimate-min', {
          pickupLat: pickupCoords.latitude,
          pickupLng: pickupCoords.longitude,
          destinationLat: destinationCoords.latitude,
          destinationLng: destinationCoords.longitude,
          rideType,
        });
        if (cancelled) return;
        const d = res.data || {};
        if (typeof d.baseFare === 'number' && Number.isFinite(d.baseFare)) {
          setBaseFareEstimate(d.baseFare);
        }
        if (typeof d.distanceKm === 'number' && Number.isFinite(d.distanceKm)) {
          setCompareDistanceKm(d.distanceKm);
        }
      } catch (_) {
        if (!cancelled) {
          setBaseFareEstimate(null);
          setCompareDistanceKm(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rideType, pickupCoords, destinationCoords]);

  useEffect(() => {
    const hasEndpoints =
      pickupCoords
      && destinationCoords
      && typeof pickupCoords.latitude === 'number'
      && typeof pickupCoords.longitude === 'number'
      && typeof destinationCoords.latitude === 'number'
      && typeof destinationCoords.longitude === 'number';

    if (!hasEndpoints) {
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
      Alert.alert('Open settings', 'Please open device settings and enable location.');
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

    await setAddressFromCoords({ latitude: first.latitude, longitude: first.longitude }, selectionMode);
  };

  const handleCompare = async () => {
    // Fetch ride options and open full-screen RideOptions screen.
    if (!pickup || !destination) return alert('Enter pickup and destination first.');
    if (!pickupCoords || !destinationCoords) return alert('Tap the map to set both locations.');

    setLoading(true);
    setBookingStatus('');
    try {
      const payload = { pickup, destination, rideType };
      payload.pickupLat = pickupCoords.latitude;
      payload.pickupLng = pickupCoords.longitude;
      payload.destinationLat = destinationCoords.latitude;
      payload.destinationLng = destinationCoords.longitude;

      const res = await farelyApi.post('/rides/compare', payload);
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : raw?.comparisons || [];
      const baseFare = Array.isArray(raw) ? null : raw?.baseFare;
      const distKm = Array.isArray(raw) ? null : raw?.distanceKm;
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
      pushAppNotification({
        type: 'ride',
        title: 'Ride options updated',
        body: `${list.length} ride option${list.length === 1 ? '' : 's'} found for your route.`,
        meta: { pickup, destination, count: list.length },
      });
      navigation.navigate('RideOptions', {
        pickup,
        destination,
        rideType,
        fares: list,
        baseFare: typeof baseFare === 'number' ? baseFare : undefined,
        distanceKm: typeof distKm === 'number' ? distKm : undefined,
      });
    } catch (err) {
      alert('Failed to get ride options');
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
                          color: '#2563eb',
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
                          color: '#2563eb',
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
          <ActivityIndicator size="large" color="#2563eb" />
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
          <FontAwesome6 name="bars" size={18} color="#fff" solid />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topBarBellBtn}
          onPress={() => navigation.navigate('Notification')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <FontAwesome6 name="bell" size={18} color="#334155" regular />
          </TouchableOpacity>
      </View>
      <Modal transparent visible={showLocationPrompt} animationType="fade" statusBarTranslucent>
        <View style={styles.locationModalOverlay}>
          <View style={styles.locationModalCard}>
            <View style={styles.locationPulseWrap}>
              <View style={styles.locationPulse3} />
              <View style={styles.locationPulse2} />
              <View style={styles.locationPulse1} />
              <View style={styles.locationPulseCenter}>
                <FontAwesome6 name="location-dot" size={18} color="#fff" solid />
              </View>
            </View>

            <Text style={styles.locationModalTitle}>Enable your location</Text>
            <Text style={styles.locationModalSubtitle}>
              {locationPromptMode === 'services'
                ? 'Location service is off. Enable GPS/Location to find nearby rides.'
                : 'Choose your location to start finding rides around you.'}
            </Text>

            <TouchableOpacity style={styles.locationPrimaryBtn} onPress={handleLocateMe}>
              <Text style={styles.locationPrimaryBtnText}>Use my location</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.locationSettingsBtn} onPress={openLocationSettings}>
              <Text style={styles.locationSettingsBtnText}>Go to settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.locationSkipBtn} onPress={() => setShowLocationPrompt(false)}>
              <Text style={styles.locationSkipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
                  })
                }
                activeOpacity={0.85}
              >
                <FontAwesome6 name="magnifying-glass" size={16} color="#2563eb" solid />
                <Text style={[styles.whereSearchText, destination ? styles.whereSearchTextActive : null]}>
                  {destination || 'Where would you go?'}
                </Text>
                <FontAwesome6 name="heart" size={16} color="#94a3b8" regular />
              </TouchableOpacity>

              <View style={styles.rideTypeRow}>
                {RIDE_TYPE_OPTIONS.map((t) => {
                  const selected = rideType === t.id;
                  const color = selected ? '#ffffff' : '#334155';
                  return (
                    <TouchableOpacity
                      key={t.id}
                      accessibilityRole="button"
                      accessibilityLabel={t.a11y}
                      accessibilityState={{ selected }}
                      style={[styles.rideTypeChip, selected && styles.rideTypeChipActive]}
                      onPress={() => setRideType(t.id)}
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
      </View>

            <Text style={styles.tipText}>Tap on the map to set destination.</Text>
            {typeof baseFareEstimate === 'number' && (
              <View style={styles.baseFareBanner}>
                <Text style={styles.baseFareLabel}>Minimum fare (estimate)</Text>
                <Text style={styles.baseFareValue}>
                  PKR {Math.round(baseFareEstimate)}
                  {typeof compareDistanceKm === 'number' ? ` · ${compareDistanceKm} km` : ''}
                </Text>
                <Text style={styles.baseFareHint}>Provider fares are this amount or higher.</Text>
              </View>
            )}
            <TouchableOpacity style={styles.compareBtn} onPress={handleCompare} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.compareBtnText}>Compare fares</Text>}
            </TouchableOpacity>
      <Text style={styles.disclaimer}>* Fares are estimates and may change on the provider's app.</Text>
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
                            <ActivityIndicator size="small" color="#fff" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapFull: { ...StyleSheet.absoluteFillObject },
  map: { flex: 1 },
  loadingMap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 8, color: '#64748b' },
  mapLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  mapLoaderText: { marginTop: 10, color: '#334155', fontWeight: '600' },
  locationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  locationModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  locationPulseWrap: { width: 136, height: 136, alignItems: 'center', justifyContent: 'center' },
  locationPulse3: { position: 'absolute', width: 122, height: 122, borderRadius: 61, backgroundColor: 'rgba(59,130,246,0.10)' },
  locationPulse2: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(59,130,246,0.16)' },
  locationPulse1: { position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(59,130,246,0.25)' },
  locationPulseCenter: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  locationModalTitle: { marginTop: 8, fontSize: 32, fontWeight: '700', color: '#1f2937' },
  locationModalSubtitle: { marginTop: 12, fontSize: 16, lineHeight: 24, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 6 },
  locationPrimaryBtn: {
    marginTop: 22,
    width: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  locationPrimaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  locationSettingsBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12 },
  locationSettingsBtnText: { color: '#3b82f6', fontSize: 16, fontWeight: '700' },
  locationSkipBtn: { marginTop: 2, paddingVertical: 10, paddingHorizontal: 12 },
  locationSkipBtnText: { color: '#b6bcc7', fontSize: 18, fontWeight: '600' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '88%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    zIndex: 2,
    elevation: 2,
  },
  sheetHandleArea: { alignItems: 'center', paddingTop: 2, paddingBottom: 10 },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#cbd5e1' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  modeBtnText: { color: '#334155', fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },
  tipText: { color: '#64748b', marginBottom: 10, fontSize: 12 },
  locateBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  locateBtnText: { color: '#2ecc71', fontWeight: '700' },
  locationError: { marginTop: 8, marginHorizontal: 16, color: '#dc2626', fontSize: 12 },
  debugText: { marginTop: 6, marginBottom: 8, marginHorizontal: 0, color: '#64748b', fontSize: 12 },
  resultsHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsHeaderText: { flex: 1, paddingRight: 12 },
  resultsTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  resultsSubtitle: { marginTop: 4, color: '#64748b', fontSize: 12 },
  bookingStatus: { marginTop: 6, color: '#16a34a', fontSize: 12, fontWeight: '600' },
  changeLocationsBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  changeLocationsText: { fontWeight: '700', color: '#334155' },
  resultsListContent: { paddingBottom: 24 },
  rideTypeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  rideTypeRaster: { width: 26, height: 26 },
  rideTypeRasterActive: { tintColor: '#fff' },
  rideTypeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rideTypeChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputFlex: { flex: 1, marginBottom: 0, paddingRight: 44 },
  clearBtn: {
    position: 'absolute',
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: { fontSize: 18, color: '#334155', fontWeight: '700', marginTop: -2 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 10, marginBottom: 10 },
  button: { backgroundColor: '#2ecc71', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  sortBtn: { marginTop: 10, alignSelf: 'flex-end' },
  sortBtnText: { color: '#3498db', fontSize: 12 },
  disclaimer: { fontSize: 10, color: '#95a5a6', marginTop: 10, fontStyle: 'italic' },
  compareBtn: {
    marginTop: 0,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  compareBtnText: { color: '#fff', fontWeight: '800' },
  baseFareBanner: {
    marginTop: 0,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  baseFareLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 },
  baseFareValue: { marginTop: 4, fontSize: 18, fontWeight: '900', color: '#0f172a' },
  baseFareHint: { marginTop: 4, fontSize: 11, color: '#64748b', fontWeight: '600' },
  fareCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 15,
    marginTop: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2
  },
  providerName: { fontSize: 18, fontWeight: 'bold' },
  rideType: { color: '#7f8c8d' },
  riderText: { color: '#64748b', fontSize: 12, marginTop: 4 },
  riderMetaText: { color: '#64748b', fontSize: 12, marginTop: 2 },
  priceContainer: { alignItems: 'flex-end' },
  price: { fontSize: 18, fontWeight: 'bold', color: '#2ecc71', marginBottom: 5 },
  bookBtn: { backgroundColor: '#3498db', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 5 },
  bookBtnText: { color: '#fff', fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#95a5a6' },

  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 72 : 34,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 60,
    elevation: 60,
  },
  topBarBtn: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  topBarMenuBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topBarBellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  whereCard: {
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  whereSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  whereSearchText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
  },
  whereSearchTextActive: { color: '#0f172a' },

  rideOverlayCover: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 16,
  },
  rideOverlayCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingBottom: 10,
  },
  rideOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  rideOverlayTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  rideOverlayChangeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  rideOverlayChangeBtnText: { fontWeight: '900', color: '#334155' },
  rideOverlayListContent: { padding: 14, gap: 12, paddingBottom: 24 },

  rideTypeLine: { marginTop: 4, color: '#334155', fontWeight: '700', fontSize: 12 },
  bookBtnDisabled: { opacity: 0.7 }
});

export default HomeScreen;
