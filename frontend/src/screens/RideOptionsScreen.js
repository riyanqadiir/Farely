import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import farelyApi from '../api/farelyApi';
import { getProviderLogo } from '../constants/brandAssets';
import { pushAppNotification } from '../utils/notifications';
import { redirectToProvider } from '../utils/providerRedirect';
import { useTheme } from '../theme/ThemeContext';
import { setPendingRideConfirmation } from '../utils/rideConfirmation';
import { showAppToast } from '../utils/appToast';

/** After a successful deep link, show pickup/drop digits for known providers. */
const MANUAL_COORDS_ALERT_TITLE_BY_PROVIDER = {
  Uber: 'Uber opened',
  Yango: 'Yango opened',
  Bykea: 'Bykea opened',
};

function RideOptionCard({ item, bookingLoadingId, onOpenApp, colors, styles }) {
  const isBooking = bookingLoadingId === item.id;
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
          Estimate confidence: {Math.round((item.estimateConfidence || 0) * 100)}%
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
          disabled={!!bookingLoadingId}
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
  const routeBaseFare = route?.params?.baseFare;
  const routeDistanceKm = route?.params?.distanceKm;
  const searchLogId = route?.params?.searchLogId;
  const pickupCoords = route?.params?.pickupCoords;
  const destinationCoords = route?.params?.destinationCoords;
  const initialCarAc = Boolean(route?.params?.carAc);

  const [rideType] = useState(initialRideType);
  const [carAc] = useState(initialCarAc);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [fares, setFares] = useState(incomingFares);
  const [bookingLoadingId, setBookingLoadingId] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');
  const [bykeaConfirmOption, setBykeaConfirmOption] = useState(null);

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

    setBookingLoadingId(id);
    setBookingStatus('Opening provider app...');
    try {
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
        estimatedFare: rideOption.fare,
        redirectAttempted: true,
        redirectSucceeded: redirect.success,
        redirectMode: redirect.mode,
        failureReason: redirect.reason || '',
      });

      const handoffId = await recordHandoff({
        searchLogId,
        selectionLogId,
        pickup,
        destination,
        pickupCoords,
        destinationCoords,
        rideType,
        carAc: rideType === 'car' ? carAc : false,
        provider: rideOption.provider,
        providerRideName: rideOption.name || rideOption.rideType || '',
        estimatedFare: rideOption.fare,
        redirectSucceeded: redirect.success,
        redirectMode: redirect.mode,
        failureReason: redirect.reason || '',
        openedUrl: redirect.openedUrl || '',
      });

      if (redirect.success && handoffId) {
        await setPendingRideConfirmation({
          handoffId,
          provider: rideOption.provider,
          providerRideName: rideOption.name || rideOption.rideType || '',
          estimatedFare: typeof rideOption.fare === 'number' ? rideOption.fare : null,
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
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Type: {rideTypeSummary} • Sort: {sortBy}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Estimates only — booking and final fare are set in Uber, Yango, or Bykea.
              </Text>
              {typeof routeBaseFare === 'number' && Number.isFinite(routeBaseFare) && (
                <View style={[styles.baseFareBanner, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}>
                  <Text style={[styles.baseFareLabel, { color: colors.textMuted }]}>Minimum base fare (estimate)</Text>
                  <Text style={[styles.baseFareValue, { color: colors.text }]}>
                    PKR {Math.round(routeBaseFare)}
                    {typeof routeDistanceKm === 'number' && Number.isFinite(routeDistanceKm)
                      ? ` · ${routeDistanceKm} km`
                      : ''}
                  </Text>
                  <Text style={[styles.baseFareHint, { color: colors.textMuted }]}>
                    Listed prices are this amount or higher.
                  </Text>
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
              Farely does not process payments. Complete checkout only inside the provider you open.
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
    meta: { marginTop: 8, fontSize: 12, fontWeight: '600' },
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
