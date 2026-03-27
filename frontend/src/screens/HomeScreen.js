import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import farelyApi from '../api/farelyApi';
import { AuthContext } from '../context/AuthContext';

const HomeScreen = () => {
  const { logout } = useContext(AuthContext);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectionMode, setSelectionMode] = useState('pickup');
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [fares, setFares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('fare'); // 'fare' or 'eta'

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
    try {
      const res = await farelyApi.post('/rides/compare', { pickup, destination });
      let data = res.data;
      if (sortBy === 'fare') {
        data.sort((a, b) => a.fare - b.fare);
      }
      setFares(data);
    } catch (err) {
      alert('Failed to get fares');
    }
    setLoading(false);
  };

  const toggleSort = () => {
    const nextSort = sortBy === 'fare' ? 'eta' : 'fare';
    setSortBy(nextSort);
    const sorted = [...fares].sort((a, b) => {
      if (nextSort === 'fare') return a.fare - b.fare;
      return parseInt(a.eta) - parseInt(b.eta);
    });
    setFares(sorted);
  };

  const handleBook = (provider) => {
    // Deep linking logic
    let url = '';
    if (provider === 'Uber') url = 'uber://';
    else if (provider === 'Careem') url = 'careem://';
    else if (provider === 'Yango') url = 'yango://';

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        alert(`Please install ${provider} app`);
      }
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutBtnText}>Log out</Text>
      </TouchableOpacity>
      <View style={styles.mapWrap}>
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
                ]}
              />
            ) : (
              <AppleMaps.View
                style={styles.map}
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
                ]}
              />
            )}
          </>
        )}
      </View>
      {!!locationError && <Text style={styles.locationError}>{locationError}</Text>}
      <View style={styles.searchContainer}>
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
            <Text
              style={[
                styles.modeBtnText,
                selectionMode === 'destination' && styles.modeBtnTextActive,
              ]}
            >
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
        <TextInput
          style={styles.input}
          placeholder="Pickup Location"
          value={pickup}
          onChangeText={setPickup}
        />
        <TextInput
          style={styles.input}
          placeholder="Destination"
          value={destination}
          onChangeText={setDestination}
        />
        <TouchableOpacity style={styles.button} onPress={handleCompare} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Compare Fares</Text>}
        </TouchableOpacity>

        {fares.length > 0 && (
          <TouchableOpacity style={styles.sortBtn} onPress={toggleSort}>
            <Text style={styles.sortBtnText}>Sorted by: {sortBy === 'fare' ? 'Cheapest' : 'Fastest'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.disclaimer}>* Fares are estimates and may change on the provider's app.</Text>

      <FlatList
        data={fares}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.fareCard}>
            <View>
              <Text style={styles.providerName}>{item.provider}</Text>
              <Text style={styles.rideType}>{item.rideType} • {item.eta}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>PKR {item.fare}</Text>
              <TouchableOpacity style={styles.bookBtn} onPress={() => handleBook(item.provider)}>
                <Text style={styles.bookBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={!loading && <Text style={styles.emptyText}>Enter locations to see fares</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  mapWrap: { height: 280, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  loadingMap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 8, color: '#64748b' },
  logoutBtn: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  searchContainer: { padding: 20, backgroundColor: '#fff', elevation: 3, marginTop: 12 },
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
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 10 },
  button: { backgroundColor: '#2ecc71', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  sortBtn: { marginTop: 10, alignSelf: 'flex-end' },
  sortBtnText: { color: '#3498db', fontSize: 12 },
  disclaimer: { fontSize: 10, color: '#95a5a6', marginHorizontal: 20, marginTop: 10, fontStyle: 'italic' },
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
  priceContainer: { alignItems: 'flex-end' },
  price: { fontSize: 18, fontWeight: 'bold', color: '#2ecc71', marginBottom: 5 },
  bookBtn: { backgroundColor: '#3498db', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 5 },
  bookBtnText: { color: '#fff', fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#95a5a6' }
});

export default HomeScreen;
