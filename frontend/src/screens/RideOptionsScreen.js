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
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import farelyApi from '../api/farelyApi';
import { getProviderLogo } from '../constants/brandAssets';
import { pushAppNotification } from '../utils/notifications';
import { useRideWidget } from '../context/RideWidgetContext';
import { fetchPaymentMethods } from '../api/paymentMethods';

const RideOptionsScreen = ({ navigation, route }) => {
  const pickup = route?.params?.pickup ?? '';
  const destination = route?.params?.destination ?? '';
  const initialRideType = route?.params?.rideType ?? 'car';
  const initialSortBy = route?.params?.sortBy ?? 'fare';
  const incomingFares = route?.params?.fares ?? [];
  const routeBaseFare = route?.params?.baseFare;
  const routeDistanceKm = route?.params?.distanceKm;

  const [rideType] = useState(initialRideType);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [fares, setFares] = useState(incomingFares);
  const [bookingLoadingId, setBookingLoadingId] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('cash');
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [cards, setCards] = useState([]);
  const { startRideWidget } = useRideWidget();

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchPaymentMethods();
        if (!mounted) return;
        setCards(list);
        const defaultCard = list.find((c) => c.isDefault) || list[0] || null;
        setSelectedCardId(defaultCard?.id || null);
      } catch (_) {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sortedFares = useMemo(() => {
    const list = Array.isArray(fares) ? [...fares] : [];
    if (sortBy === 'fare') return list.sort((a, b) => (a?.fare ?? 0) - (b?.fare ?? 0));
    return list.sort((a, b) => parseInt(a?.eta ?? '0', 10) - parseInt(b?.eta ?? '0', 10));
  }, [fares, sortBy]);

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

  const handleBook = async (rideOption) => {
    const id = rideOption?.id;
    if (!id || bookingLoadingId) return;
    if (selectedMethod === 'card' && !selectedCardId) {
      Alert.alert('Card required', 'Please add/select a card before booking with card.');
      return;
    }

    setBookingLoadingId(id);
    setBookingStatus('Assigning driver...');
    try {
      const res = await farelyApi.post('/rides/compare', {
        rideId: id,
        action: 'book',
        paymentMethod: selectedMethod,
        paymentMethodId: selectedMethod === 'card' ? selectedCardId : null,
      });
      const { driver, driverLocation, status } = res.data || {};

      if (!mountedRef.current) return;

      setBookingStatus(status || 'Driver Assigned');
      startRideWidget({
        id: id,
        rideId: id,
        provider: rideOption?.provider || '',
        driverName: driver?.name || rideOption?.rider?.name || 'Driver',
        driverPhone: driver?.phone || rideOption?.rider?.phone || '',
        numberPlate: driver?.numberPlate || rideOption?.rider?.numberPlate || '',
        pickup,
        destination,
        fare: typeof rideOption?.fare === 'number' ? rideOption.fare : null,
        paymentMethod: selectedMethod,
        paymentMethodId: selectedMethod === 'card' ? selectedCardId : null,
        paymentMethodLabel:
          selectedMethod === 'card'
            ? `Card ${cards.find((c) => c.id === selectedCardId)?.last4 || ''}`.trim()
            : selectedMethod === 'wallet'
              ? 'Wallet'
              : 'Cash',
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      pushAppNotification({
        type: 'ride',
        title: 'Driver assigned',
        body: `${driver?.name || 'Your driver'} accepted your ride on ${rideOption?.provider || 'Farely'}.`,
        meta: { rideId: rideOption?.id || null, provider: rideOption?.provider || '' },
      });

      navigation.navigate('Chat', {
        booking: { driver, driverLocation, status: status || 'Driver Assigned' },
        rideOption,
        pickup,
        destination,
        selectedPaymentMethod: selectedMethod,
        selectedPaymentMethodId: selectedMethod === 'card' ? selectedCardId : null,
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
        <View style={styles.backRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goToRideHome}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Back to ride map"
          >
            <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
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
              {typeof routeBaseFare === 'number' && Number.isFinite(routeBaseFare) && (
                <View style={styles.baseFareBanner}>
                  <Text style={styles.baseFareLabel}>Minimum base fare (estimate)</Text>
                  <Text style={styles.baseFareValue}>
                    PKR {Math.round(routeBaseFare)}
                    {typeof routeDistanceKm === 'number' && Number.isFinite(routeDistanceKm)
                      ? ` · ${routeDistanceKm} km`
                      : ''}
                  </Text>
                  <Text style={styles.baseFareHint}>Listed prices are this amount or higher.</Text>
                </View>
              )}
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
          <View style={styles.paymentChoiceCard}>
            <Text style={styles.paymentChoiceTitle}>Pay for this ride with</Text>
            <View style={styles.paymentChoices}>
              {['cash', 'card', 'wallet'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.paymentChip, selectedMethod === m ? styles.paymentChipOn : null]}
                  onPress={() => setSelectedMethod(m)}
                >
                  <Text style={[styles.paymentChipText, selectedMethod === m ? styles.paymentChipTextOn : null]}>
                    {m.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedMethod === 'card' && (
              <View style={styles.cardPickRow}>
                {cards.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    style={[styles.cardPick, selectedCardId === card.id ? styles.cardPickOn : null]}
                    onPress={() => setSelectedCardId(card.id)}
                  >
                    <Text style={styles.cardPickText}>
                      {card.brand?.toUpperCase()} •••• {card.last4}
                    </Text>
                  </TouchableOpacity>
                ))}
                {!cards.length && <Text style={styles.noCardText}>No card saved. Add from Payment Methods.</Text>}
              </View>
            )}
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
  backText: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
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
  baseFareBanner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  baseFareLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3 },
  baseFareValue: { marginTop: 4, fontSize: 17, fontWeight: '900', color: '#0f172a' },
  baseFareHint: { marginTop: 4, fontSize: 11, color: '#64748b', fontWeight: '600' },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  paymentChoiceCard: {
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  paymentChoiceTitle: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  paymentChoices: { flexDirection: 'row', gap: 8, marginTop: 8 },
  paymentChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  paymentChipOn: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  paymentChipText: { fontWeight: '800', fontSize: 11, color: '#475569' },
  paymentChipTextOn: { color: '#1d4ed8' },
  cardPickRow: { marginTop: 8, gap: 6 },
  cardPick: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff', padding: 8 },
  cardPickOn: { borderColor: '#2563eb', backgroundColor: '#dbeafe' },
  cardPickText: { fontSize: 11, fontWeight: '700', color: '#0f172a' },
  noCardText: { fontSize: 11, color: '#dc2626', fontWeight: '700' },
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

