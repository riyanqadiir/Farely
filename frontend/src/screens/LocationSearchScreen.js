import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Constants from 'expo-constants';
import { CommonActions } from '@react-navigation/native';
import farelyApi from '../api/farelyApi';
import { getCapturedFaresForContext } from '../utils/liveFareStore';

const RECENT_PLACES = [
  { id: 'r1', name: 'Office', detail: 'House 45, Block C, Model Town, Lahore', km: '2.7km' },
  { id: 'r2', name: 'Coffee shop', detail: 'House 12, DHA Phase 3, Lahore', km: '1.1km' },
  { id: 'r3', name: 'Shopping center', detail: 'House 7B, Block H, Johar Town, Lahore', km: '4.9km' },
];

const resolveMapsApiKey = () => {
  const fromExpoConfig = Constants.expoConfig?.extra?.googleMapsApiKey;
  const fromManifest = Constants.manifest?.extra?.googleMapsApiKey;
  const fromManifest2Client = Constants.manifest2?.extra?.expoClient?.extra?.googleMapsApiKey;
  const fromManifest2 = Constants.manifest2?.extra?.googleMapsApiKey;
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return fromExpoConfig || fromManifest || fromManifest2Client || fromManifest2 || fromEnv || '';
};

const mapsApiKey = resolveMapsApiKey();

const LocationSearchScreen = ({ navigation, route }) => {
  const initialPickup = route?.params?.pickup ?? '';
  const initialDestination = route?.params?.destination ?? '';
  const initialPickupCoords = route?.params?.pickupCoords ?? null;
  const initialDestinationCoords = route?.params?.destinationCoords ?? null;
  const currentLocation = route?.params?.currentLocation ?? null;
  const rideType = route?.params?.rideType ?? 'car';
  const carAc = Boolean(route?.params?.carAc);

  const [fromPlace, setFromPlace] = useState({
    label: initialPickup,
    coords: initialPickupCoords,
  });
  const [toPlace, setToPlace] = useState({
    label: initialDestination,
    coords: initialDestinationCoords,
  });
  const [activeField, setActiveField] = useState(initialDestination ? 'to' : 'from');
  const [query, setQuery] = useState(initialDestination || initialPickup || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoadingId, setDetailsLoadingId] = useState(null);
  const [apiError, setApiError] = useState('');
  const [minEstimate, setMinEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState('');

  const reqCounter = useRef(0);
  const estimateReqId = useRef(0);

  useEffect(() => {
    if (activeField === 'from') setQuery(fromPlace.label || '');
    else setQuery(toPlace.label || '');
  }, [activeField, fromPlace.label, toPlace.label]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2 || !mapsApiKey) {
      setSuggestions([]);
      setApiError(mapsApiKey ? '' : 'Google Places key missing. Add extra.googleMapsApiKey in app config.');
      return;
    }

    const id = ++reqCounter.current;
    setLoading(true);
    setApiError('');

    const timer = setTimeout(async () => {
      try {
        const url =
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}`
          + `&key=${encodeURIComponent(mapsApiKey)}`
          + `&components=country:pk`;

        const res = await fetch(url);
        const data = await res.json();
        if (id !== reqCounter.current) return;

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          setSuggestions([]);
          setApiError(data.error_message || `Places autocomplete failed: ${data.status}`);
          return;
        }

        const mapped = (data.predictions || []).map((p) => ({
          id: p.place_id,
          title: p.structured_formatting?.main_text || p.description,
          subtitle: p.structured_formatting?.secondary_text || '',
          description: p.description || '',
        }));
        setSuggestions(mapped);
      } catch (_) {
        if (id !== reqCounter.current) return;
        setSuggestions([]);
        setApiError('Could not fetch places. Check network and Places API configuration.');
      } finally {
        if (id === reqCounter.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const from = fromPlace.coords;
    const to = toPlace.coords;
    const coordsOk =
      from
      && to
      && typeof from.latitude === 'number'
      && typeof from.longitude === 'number'
      && typeof to.latitude === 'number'
      && typeof to.longitude === 'number';

    if (!coordsOk) {
      estimateReqId.current += 1;
      setMinEstimate(null);
      setEstimateError('');
      setEstimateLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      const reqId = ++estimateReqId.current;
      try {
        setEstimateLoading(true);
        setEstimateError('');
        const captured = await getCapturedFaresForContext(
          from,
          to,
          rideType,
          rideType === 'car' ? carAc : false
        );
        const liveCalibration = captured
          .filter((c) => /yango|bykea/i.test(String(c?.provider || '')))
          .map((c) => ({ provider: String(c.provider), fare: Number(c.fare) }))
          .filter((c) => Number.isFinite(c.fare) && c.fare > 0);

        const res = await farelyApi.post('/rides/estimate-min', {
          pickupLat: from.latitude,
          pickupLng: from.longitude,
          destinationLat: to.latitude,
          destinationLng: to.longitude,
          rideType,
          carAc: rideType === 'car' ? carAc : false,
          ...(liveCalibration.length ? { liveCalibration } : {}),
        });
        if (reqId !== estimateReqId.current) return;
        setMinEstimate(res.data || null);
      } catch (err) {
        if (reqId !== estimateReqId.current) return;
        setMinEstimate(null);
        setEstimateError(err.response?.data?.msg || 'Could not load minimum fare');
      } finally {
        if (reqId === estimateReqId.current) setEstimateLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [fromPlace.coords, toPlace.coords, rideType, carAc]);

  const canConfirm = !!fromPlace.label && !!toPlace.label && !!fromPlace.coords && !!toPlace.coords;

  const applyPlaceToField = (label, coords) => {
    if (activeField === 'from') {
      setFromPlace({ label, coords });
      setActiveField('to');
    } else {
      setToPlace({ label, coords });
    }
  };

  const selectSuggestion = async (item) => {
    if (!item?.id || detailsLoadingId) return;
    setDetailsLoadingId(item.id);

    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(item.id)}`
        + `&fields=formatted_address,geometry/location,name`
        + `&key=${encodeURIComponent(mapsApiKey)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== 'OK') {
        setApiError(data.error_message || `Place details failed: ${data.status}`);
        return;
      }

      const result = data.result || {};
      const location = result.geometry?.location;
      const coords =
        location && typeof location.lat === 'number' && typeof location.lng === 'number'
          ? { latitude: location.lat, longitude: location.lng }
          : null;
      const label = result.formatted_address || result.name || item.description;

      applyPlaceToField(label, coords);
      setSuggestions([]);
    } catch (_) {
      setApiError('Could not fetch place details. Please try again.');
    } finally {
      setDetailsLoadingId(null);
    }
  };

  const useCurrentLocationForFrom = () => {
    if (!currentLocation) return;
    setFromPlace({
      label: fromPlace.label || 'Current location',
      coords: currentLocation,
    });
    setActiveField('to');
  };

  const applyRecentToActive = (item) => {
    if (!item) return;
    if (activeField === 'from') setFromPlace({ label: item.name, coords: null });
    else setToPlace({ label: item.name, coords: null });
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    const locationSelection = {
      pickup: fromPlace.label,
      destination: toPlace.label,
      pickupCoords: fromPlace.coords,
      destinationCoords: toPlace.coords,
      baseFareEstimate: typeof minEstimate?.baseFare === 'number' ? minEstimate.baseFare : undefined,
      distanceKmEstimate: typeof minEstimate?.distanceKm === 'number' ? minEstimate.distanceKm : undefined,
      ts: Date.now(),
    };
    // Merge params into the Rides tab; replace() often fails to apply nested tab params reliably.
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Main',
        params: {
          screen: 'Rides',
          params: { locationSelection },
        },
      })
    );
  };

  const suggestionsTitle = useMemo(() => {
    if (activeField === 'from') return 'Search pickup location';
    return 'Search destination location';
  }, [activeField]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.header}>
            <Text style={styles.title}>Select address</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
              <FontAwesome6 name="xmark" size={14} color="#94a3b8" solid />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.inputRow, activeField === 'from' ? styles.inputActive : null]}
            onPress={() => setActiveField('from')}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="location-crosshairs" size={13} color="#10b981" solid />
            <TextInput
              style={styles.input}
              value={fromPlace.label}
              placeholder="From"
              placeholderTextColor="#9ca3af"
              onChangeText={(text) => {
                setFromPlace((prev) => ({ ...prev, label: text, coords: null }));
                if (activeField !== 'from') setActiveField('from');
                setQuery(text);
              }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.inputRow, activeField === 'to' ? styles.inputActive : null]}
            onPress={() => setActiveField('to')}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="location-dot" size={13} color="#ef4444" solid />
            <TextInput
              style={styles.input}
              value={toPlace.label}
              placeholder="To"
              placeholderTextColor="#9ca3af"
              onChangeText={(text) => {
                setToPlace((prev) => ({ ...prev, label: text, coords: null }));
                if (activeField !== 'to') setActiveField('to');
                setQuery(text);
              }}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.currentLocBtn} onPress={useCurrentLocationForFrom} disabled={!currentLocation}>
            <FontAwesome6 name="location-arrow" size={12} color="#10b981" solid />
            <Text style={styles.currentLocText}>Current location</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>{suggestionsTitle}</Text>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const loadingItem = detailsLoadingId === item.id;
                return (
                  <TouchableOpacity style={styles.suggestionRow} onPress={() => selectSuggestion(item)}>
                    <FontAwesome6 name="location-dot" size={12} color="#64748b" solid />
                    <View style={styles.suggestionTextWrap}>
                      <Text style={styles.suggestionTitle}>{item.title}</Text>
                      {!!item.subtitle && <Text style={styles.suggestionSubtitle}>{item.subtitle}</Text>}
                    </View>
                    {loadingItem ? <ActivityIndicator size="small" color="#2563eb" /> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>Start typing to search places</Text>}
            />
          )}

          {!!apiError && <Text style={styles.errorText}>{apiError}</Text>}

          <Text style={[styles.sectionTitle, styles.recentTitle]}>Recent places</Text>
          <View>
            {RECENT_PLACES.map((item) => (
              <TouchableOpacity key={item.id} style={styles.recentRow} onPress={() => applyRecentToActive(item)}>
                <View style={styles.recentLeft}>
                  <FontAwesome6 name="location-dot" size={12} color="#64748b" solid />
                  <View>
                    <Text style={styles.recentName}>{item.name}</Text>
                    <Text style={styles.recentDetail}>{item.detail}</Text>
                  </View>
                </View>
                <Text style={styles.recentKm}>{item.km}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {(estimateLoading || minEstimate || estimateError) && (
            <View style={styles.minFareBanner}>
              <Text style={styles.minFareLabel}>Minimum base fare (estimate)</Text>
              {estimateLoading ? (
                <View style={styles.minFareLoadingRow}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.minFareLoadingText}>Calculating…</Text>
                </View>
              ) : minEstimate ? (
                <>
                  <Text style={styles.minFareValue}>
                    PKR {Math.round(minEstimate.baseFare)}
                    {typeof minEstimate.distanceKm === 'number' ? ` · ${minEstimate.distanceKm} km` : ''}
                  </Text>
                  <Text style={styles.minFareHint}>
                    For selected ride type (
                    {rideType === 'car' ? `${rideType}${carAc ? ', with AC' : ', no AC'}` : rideType}
                    ). Provider fares are this or higher.
                  </Text>
                  {minEstimate.calibratedFromScrapes ? (
                    <Text style={[styles.minFareHint, { marginTop: 6 }]}>
                      Includes calibration from saved Yango / Bykea prices for this route.
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.minFareErr}>{estimateError}</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, canConfirm ? null : styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
          >
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  sheetHandle: {
    width: 64,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: '#9ca3af',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 46,
    marginBottom: 8,
    gap: 10,
  },
  inputActive: { borderColor: '#14b8a6', backgroundColor: '#ecfeff' },
  input: { flex: 1, color: '#111827', fontWeight: '600' },
  currentLocBtn: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  currentLocText: { color: '#0f766e', fontWeight: '700', fontSize: 12 },
  sectionTitle: { color: '#374151', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  list: { maxHeight: 160, marginBottom: 8 },
  loadingRow: { height: 90, alignItems: 'center', justifyContent: 'center' },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  suggestionTextWrap: { flex: 1 },
  suggestionTitle: { color: '#111827', fontWeight: '700', fontSize: 13 },
  suggestionSubtitle: { color: '#64748b', fontSize: 11, marginTop: 2 },
  empty: { color: '#94a3b8', fontSize: 12, paddingVertical: 12, textAlign: 'center' },
  errorText: { color: '#dc2626', fontSize: 11, marginBottom: 8 },
  recentTitle: { marginTop: 2 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  recentLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  recentName: { color: '#111827', fontWeight: '700', fontSize: 13 },
  recentDetail: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  recentKm: { color: '#4b5563', fontSize: 12, fontWeight: '700' },
  minFareBanner: {
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  minFareLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 },
  minFareValue: { marginTop: 4, fontSize: 17, fontWeight: '900', color: '#0f172a' },
  minFareHint: { marginTop: 4, fontSize: 11, color: '#64748b', fontWeight: '600' },
  minFareLoadingRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  minFareLoadingText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  minFareErr: { marginTop: 4, fontSize: 11, color: '#dc2626', fontWeight: '600' },
  confirmBtn: {
    marginTop: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { color: '#fff', fontWeight: '800' },
});

export default LocationSearchScreen;

