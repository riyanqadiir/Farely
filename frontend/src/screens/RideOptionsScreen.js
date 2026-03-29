import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import farelyApi from '../api/farelyApi';
import { getProviderLogo } from '../constants/brandAssets';

const RideOptionsScreen = ({ navigation, route }) => {
  const pickup = route?.params?.pickup ?? '';
  const destination = route?.params?.destination ?? '';
  const initialRideType = route?.params?.rideType ?? 'car';
  const initialSortBy = route?.params?.sortBy ?? 'fare';
  const incomingFares = route?.params?.fares ?? [];

  const [rideType] = useState(initialRideType);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [fares, setFares] = useState(incomingFares);
  const [bookingLoadingId, setBookingLoadingId] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setFares(incomingFares);
  }, [incomingFares]);

  const sortedFares = useMemo(() => {
    const list = Array.isArray(fares) ? [...fares] : [];
    if (sortBy === 'fare') return list.sort((a, b) => (a?.fare ?? 0) - (b?.fare ?? 0));
    return list.sort((a, b) => parseInt(a?.eta ?? '0', 10) - parseInt(b?.eta ?? '0', 10));
  }, [fares, sortBy]);

  const toggleSort = () => setSortBy((v) => (v === 'fare' ? 'eta' : 'fare'));

  const handleChange = () => {
    navigation.goBack();
  };

  const handleBook = async (rideOption) => {
    const id = rideOption?.id;
    if (!id || bookingLoadingId) return;

    setBookingLoadingId(id);
    setBookingStatus('Assigning driver...');
    try {
      const res = await farelyApi.post('/rides/compare', { rideId: id, action: 'book' });
      const { driver, driverLocation, status } = res.data || {};

      if (!mountedRef.current) return;

      setBookingStatus(status || 'Driver Assigned');

      navigation.navigate('Chat', {
        booking: { driver, driverLocation, status: status || 'Driver Assigned' },
        rideOption,
        pickup,
        destination,
      });
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Booking failed';
      Alert.alert('Booking failed', msg);
    } finally {
      if (mountedRef.current) setBookingLoadingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Ride options</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {pickup} → {destination}
              </Text>
              {!!bookingStatus && <Text style={styles.bookingStatus}>{bookingStatus}</Text>}
              <Text style={styles.meta}>
                Type: {rideType} • Sort: {sortBy}
              </Text>
            </View>

            <View style={styles.headerBtns}>
              <TouchableOpacity style={styles.sortBtn} onPress={toggleSort}>
                <Text style={styles.sortBtnText}>Sort</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.changeBtn} onPress={handleChange}>
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <FlatList
          data={sortedFares}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No rides found</Text>
              <Text style={styles.emptyText}>Go back and try a different pickup/destination.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isBooking = bookingLoadingId === item.id;
            const logo = getProviderLogo(item.provider);
            return (
              <View style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={styles.providerRow}>
                    {!!logo && <Image source={logo} style={styles.providerLogo} resizeMode="contain" />}
                    <Text style={styles.provider}>{item.provider}</Text>
                  </View>
                  <Text style={styles.ride}>
                    {(item.name || item.rideType)} • {item.eta} •{' '}
                    {typeof item.distanceKm === 'number' ? `${item.distanceKm} km` : '—'}
                  </Text>
                  {!!item.rider?.name && <Text style={styles.rider}>Rider: {item.rider.name}</Text>}
                  {!!item.rider?.phone && <Text style={styles.riderMeta}>Phone: {item.rider.phone}</Text>}
                  {!!item.rider?.numberPlate && (
                    <Text style={styles.riderMeta}>Car No: {item.rider.numberPlate}</Text>
                  )}
                </View>

                <View style={styles.cardRight}>
                  <Text style={styles.price}>PKR {Math.round(item.fare)}</Text>
                  <TouchableOpacity
                    style={[styles.bookBtn, isBooking ? styles.bookBtnDisabled : null]}
                    onPress={() => handleBook(item)}
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
      </View>
    </SafeAreaView>
  );
};

export default RideOptionsScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 6, color: '#64748b', fontSize: 12 },
  bookingStatus: { marginTop: 8, color: '#16a34a', fontSize: 12, fontWeight: '700' },
  meta: { marginTop: 8, color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sortBtn: {
    backgroundColor: '#111827',
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  sortBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  changeBtn: {
    backgroundColor: '#2563eb',
    minWidth: 74,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  changeBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  listContent: { padding: 16, paddingBottom: 24, gap: 12 },
  empty: { padding: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  emptyText: { marginTop: 8, color: '#64748b', fontSize: 12, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardLeft: { flex: 1 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  providerLogo: { width: 28, height: 28, borderRadius: 6 },
  provider: { fontSize: 15, fontWeight: '900', color: '#111827', flex: 1 },
  ride: { marginTop: 4, color: '#334155', fontWeight: '700', fontSize: 12 },
  rider: { marginTop: 8, color: '#0f172a', fontWeight: '700', fontSize: 12 },
  riderMeta: { marginTop: 2, color: '#64748b', fontWeight: '600', fontSize: 12 },
  cardRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  price: { fontSize: 14, fontWeight: '900', color: '#111827' },
  bookBtn: {
    marginTop: 10,
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 74,
    alignItems: 'center',
  },
  bookBtnDisabled: { opacity: 0.7 },
  bookBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});

