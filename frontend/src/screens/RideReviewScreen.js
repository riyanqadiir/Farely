import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import farelyApi from '../api/farelyApi';
import { useTheme } from '../theme/ThemeContext';
import { showAppToast } from '../utils/appToast';
import { removePendingRideConfirmation } from '../utils/rideConfirmation';
import { syncCaptureForPendingHandoff } from '../utils/handoffCaptureSync';

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

function mapUrlForRide(ride) {
  const p = ride?.pickupCoords;
  const d = ride?.destinationCoords;
  if (
    !p || !d
    || typeof p.latitude !== 'number' || typeof p.longitude !== 'number'
    || typeof d.latitude !== 'number' || typeof d.longitude !== 'number'
  ) {
    return '';
  }

  const size = '560x220';
  const start = `${p.latitude},${p.longitude}`;
  const end = `${d.latitude},${d.longitude}`;
  const path = `color:0x7aa52aff|weight:5|${start}|${end}`;
  const markers = [
    `color:green|label:S|${start}`,
    `color:red|label:D|${end}`,
  ];
  const params = [
    `size=${size}`,
    `maptype=roadmap`,
    `path=${encodeURIComponent(path)}`,
    ...markers.map((m) => `markers=${encodeURIComponent(m)}`),
    `key=${encodeURIComponent(MAPS_KEY)}`,
  ].join('&');
  return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}

const RideReviewScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await farelyApi.get('/rides/pending-reviews');
      setRides(Array.isArray(res.data?.rides) ? res.data.rides : []);
    } catch (_) {
      setRides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (item, taken) => {
    const id = item?._id;
    if (!id) return;
    let capturedFare = item.capturedFare;
    let capturedProvider = item.capturedProvider || item.provider;
    if (!(typeof capturedFare === 'number' && capturedFare > 0)) {
      const synced = await syncCaptureForPendingHandoff({
        handoffId: id,
        provider: item.provider,
        pickupCoords: item.pickupCoords,
        destinationCoords: item.destinationCoords,
        rideType: item.rideType,
        carAc: item.carAc,
      });
      if (synced?.capturedFare) {
        capturedFare = synced.capturedFare;
        capturedProvider = synced.capturedProvider || capturedProvider;
      }
    }
    try {
      const body = { handoffId: id, taken };
      if (typeof capturedFare === 'number' && capturedFare > 0) {
        body.capturedFare = Math.round(capturedFare);
        body.capturedProvider = capturedProvider;
      }
      await farelyApi.post('/rides/ride-handoff/confirm', body);
      await removePendingRideConfirmation(id);
      setRides((prev) => prev.filter((item) => item._id !== id));
      showAppToast({
        title: taken ? 'Ride confirmed' : 'Ride not taken',
        body: taken ? 'Saved in your history.' : 'Removed from pending reviews.',
        tone: taken ? 'success' : 'info',
      });
    } catch (_) {
      showAppToast({ title: 'Could not update', body: 'Please try again.', tone: 'error' });
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color={colors.accent} solid />
          <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Pending ride reviews</Text>
        <View style={{ width: 64 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={rides.length ? styles.list : styles.emptyList}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No pending rides to review.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.provider, { color: colors.text }]}>
                {item.provider} {typeof item.estimatedFare === 'number' ? `• PKR ${Math.round(item.estimatedFare)}` : ''}
              </Text>
              <Text style={[styles.route, { color: colors.textSecondary }]}>
                {(item.pickup || 'Pickup')} {'->'} {(item.destination || 'Destination')}
              </Text>
              {!!mapUrlForRide(item) && (
                <View style={[styles.mapWrap, { borderColor: colors.border }]}>
                  <Image
                    source={{ uri: mapUrlForRide(item) }}
                    style={styles.mapImage}
                    resizeMode="cover"
                  />
                </View>
              )}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.noBtn, { borderColor: colors.borderStrong, backgroundColor: colors.chipInactive }]}
                  onPress={() => decide(item, false)}
                >
                  <Text style={[styles.noText, { color: colors.textSecondary }]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.yesBtn, { backgroundColor: colors.accent }]}
                  onPress={() => decide(item, true)}
                >
                  <Text style={[styles.yesText, { color: colors.onAccent }]}>Yes, took ride</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default RideReviewScreen;

function createStyles() {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
      borderBottomWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 64 },
    backText: { fontWeight: '800', fontSize: 12 },
    title: { fontSize: 17, fontWeight: '900' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 16, gap: 12, paddingBottom: 24 },
    emptyList: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    emptyText: { textAlign: 'center', fontWeight: '600' },
    card: { borderWidth: 1, borderRadius: 14, padding: 12 },
    provider: { fontSize: 14, fontWeight: '900' },
    route: { marginTop: 6, fontSize: 12, fontWeight: '700' },
    mapWrap: {
      marginTop: 10,
      borderWidth: 1,
      borderRadius: 10,
      overflow: 'hidden',
      height: 110,
    },
    mapImage: {
      width: '100%',
      height: '100%',
    },
    actions: { marginTop: 12, flexDirection: 'row', gap: 10 },
    noBtn: { flex: 1, borderWidth: 1, borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
    noText: { fontWeight: '800' },
    yesBtn: { flex: 1.4, borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
    yesText: { fontWeight: '900' },
  });
}
