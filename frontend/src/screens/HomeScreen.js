import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
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

const TUK_TUK_PNG = require('../../assets/images/ride-types/tuktuk.png');

const RIDE_TYPE_OPTIONS = [
  { id: 'bike', kind: 'fa', icon: 'motorcycle', a11y: 'Bike' },
  { id: 'rickshaw', kind: 'image', source: TUK_TUK_PNG, a11y: 'Rickshaw' },
  { id: 'car', kind: 'fa', icon: 'car', a11y: 'Car' },
];
const RIDE_TYPE_ICON_SIZE = 22;
const FLATICON_TUKTUK = 'https://www.flaticon.com/free-icons/tuktuk';

const HomeScreen = ({ navigation, route }) => {
  const [rideType, setRideType] = useState('car'); // rickshaw | bike | car
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectionMode, setSelectionMode] = useState('pickup');
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [loading, setLoading] = useState(false);
  const [driverCoords, setDriverCoords] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');
  const [routeCoords, setRouteCoords] = useState([]);
  const [mapReady, setMapReady] = useState(false);
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

  useEffect(() => {
    let mounted = true;
    const loadCurrentLocation = async () => {
      try {
        setLocationError('');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied. Please enable it in Android Settings.');
          Alert.alert('Permission needed', 'Please allow location access to use the map ride flow.');
          return;
        }
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          setLocationError('Location services are turned off. Please enable Location/GPS.');
          Alert.alert('Location services off', 'Please enable Location/GPS and try again.');
          return;
        }
        if (Platform.OS === 'android') {
          // Ensures "High accuracy" mode is enabled (Wi-Fi/cell + GPS via Google Play services).
          await Location.enableNetworkProviderAsync().catch(() => null);
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
          mayShowUserSettingsDialog: true,
          timeInterval: 1000,
          distanceInterval: 1,
        });
        if (!mounted) return;
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCurrentLocation(coords);

        if (!pickupCoords) {
          setPickupCoords(coords);
          const geocode = await Location.reverseGeocodeAsync(coords).catch(() => null);
          const place = geocode?.[0];
          const fallback = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
          const label = place ? [place.name, place.street, place.city].filter(Boolean).join(', ') : '';
          setPickup(label || fallback);
        }
      } catch (_) {
        setLocationError('Could not fetch current location. Please try again.');
        Alert.alert('Location error', 'Could not fetch current location.');
      } finally {
        if (mounted) setLocating(false);
      }
    };

    loadCurrentLocation();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLocateMe = async () => {
    setLocating(true);
    let mounted = true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable it in Android Settings.');
        Alert.alert('Permission needed', 'Please allow location access to use the map ride flow.');
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationError('Location services are turned off. Please enable Location/GPS.');
        Alert.alert('Location services off', 'Please enable Location/GPS and try again.');
        return;
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
      if (!mounted) return;
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCurrentLocation(coords);
      setPickupCoords(coords);
      const geocode = await Location.reverseGeocodeAsync(coords).catch(() => null);
      const place = geocode?.[0];
      const fallback = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      const label = place ? [place.name, place.street, place.city].filter(Boolean).join(', ') : '';
      setPickup(label || fallback);
      // Move user-flow forward automatically after they set pickup
      setSelectionMode('destination');
    } catch (_) {
      setLocationError('Could not fetch current location. Please try again.');
      Alert.alert('Location error', 'Could not fetch current location.');
    } finally {
      if (mounted) setLocating(false);
    }
  };

  const setAddressFromCoords = async (coords, target) => {
    try {
      // If pickup/destination changes, clear any previous booking simulation.
      resetBookingSimulation();
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
    if (!pickup || !destination) return alert('Enter locations');
    setLoading(true);
    resetBookingSimulation();
    try {
      const payload = { pickup, destination, rideType };
      if (pickupCoords && destinationCoords) {
        payload.pickupLat = pickupCoords.latitude;
        payload.pickupLng = pickupCoords.longitude;
        payload.destinationLat = destinationCoords.latitude;
        payload.destinationLng = destinationCoords.longitude;
      }

      const res = await farelyApi.post('/rides/compare', payload);
      const data = res.data || [];
      navigation.navigate('RideOptions', {
        pickup,
        destination,
        rideType,
        fares: data,
      });
    } catch (err) {
      alert('Failed to get fares');
    }
    setLoading(false);
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
                        style={styles.rideTypeRaster}
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
            <Text style={styles.rideTypeAttribution}>
              Rickshaw:{' '}
              <Text style={styles.rideTypeAttributionLink} onPress={() => Linking.openURL(FLATICON_TUKTUK)}>
                Tuktuk icon — Maan Icons / Flaticon
              </Text>
            </Text>

            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, selectionMode === 'pickup' && styles.modeBtnActive]}
                onPress={() => setSelectionMode('pickup')}
              >
                <Text style={[styles.modeBtnText, selectionMode === 'pickup' && styles.modeBtnTextActive]}>
                  Set Pickup
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, selectionMode === 'destination' && styles.modeBtnActive]}
                onPress={() => setSelectionMode('destination')}
              >
                <Text style={[styles.modeBtnText, selectionMode === 'destination' && styles.modeBtnTextActive]}>
                  Set Destination
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.locateBtn} onPress={handleLocateMe} disabled={locating}>
              <Text style={styles.locateBtnText}>Locate me</Text>
            </TouchableOpacity>

            {!!currentLocation && (
              <Text style={styles.debugText}>
                Current coords: {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </Text>
            )}

            <Text style={styles.tipText}>Tap on the map to set {selectionMode} location.</Text>

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Pickup Location"
                value={pickup}
                onChangeText={setPickup}
              />
              {!!pickup && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    setPickup('');
                    setPickupCoords(null);
                    setRouteCoords([]);
                    setSelectionMode('pickup');
                  }}
                >
                  <Text style={styles.clearBtnText}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Destination"
                value={destination}
                onChangeText={setDestination}
              />
              {!!destination && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    setDestination('');
                    setDestinationCoords(null);
                    setRouteCoords([]);
                    setSelectionMode('destination');
                  }}
                >
                  <Text style={styles.clearBtnText}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleCompare} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Compare Fares</Text>}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>* Fares are estimates and may change on the provider's app.</Text>
        </>
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
  rideTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  rideTypeRaster: { width: 26, height: 26 },
  rideTypeAttribution: { fontSize: 10, color: '#94a3b8', marginBottom: 10, textAlign: 'center' },
  rideTypeAttributionLink: { color: '#64748b', textDecorationLine: 'underline' },
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
  emptyText: { textAlign: 'center', marginTop: 40, color: '#95a5a6' }
});

export default HomeScreen;
