import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import farelyApi from '../api/farelyApi';
import { useTheme } from '../theme/ThemeContext';

function formatWhen(v) {
  if (!v) return 'Unknown time';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'Unknown time';
  return d.toLocaleString();
}

const RideHistoryScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rides, setRides] = useState([]);

  const load = async ({ pullToRefresh = false } = {}) => {
    if (pullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await farelyApi.get('/rides/history');
      const list = Array.isArray(res.data?.rides) ? res.data.rides : [];
      setRides(list);
    } catch (_) {
      setRides([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color={colors.accent} solid />
          <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Ride history</Text>
        <View style={{ width: 64 }} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading ride history...</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={rides.length ? styles.list : styles.listEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ pullToRefresh: true })}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No confirmed rides yet</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                When you return from Uber, Yango, or Bykea and confirm a ride, it appears here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={styles.row}>
                <Text style={[styles.provider, { color: colors.text }]}>{item.provider || 'Provider'}</Text>
                {typeof item.estimatedFare === 'number' && (
                  <Text style={[styles.fare, { color: colors.accent }]}>PKR {Math.round(item.estimatedFare)}</Text>
                )}
              </View>
              <Text style={[styles.route, { color: colors.textSecondary }]}>
                {(item.pickup || 'Pickup')} -> {(item.destination || 'Destination')}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Type: {item.rideType || 'car'}
                {item.rideType === 'car' ? ` (${item.carAc ? 'with AC' : 'no AC'})` : ''}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Confirmed: {formatWhen(item.userConfirmedAt || item.updatedAt || item.createdAt)}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default RideHistoryScreen;

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
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 88 },
    backText: { fontWeight: '800', fontSize: 12 },
    title: { fontSize: 18, fontWeight: '900' },
    centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 10, fontWeight: '600' },
    list: { padding: 16, gap: 12, paddingBottom: 28 },
    listEmpty: { flexGrow: 1, padding: 16 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
    emptyTitle: { fontSize: 16, fontWeight: '800' },
    emptySub: { marginTop: 8, textAlign: 'center', fontSize: 13, lineHeight: 20, fontWeight: '600' },
    card: { borderWidth: 1, borderRadius: 14, padding: 12 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    provider: { fontSize: 15, fontWeight: '900' },
    fare: { fontSize: 14, fontWeight: '900' },
    route: { marginTop: 6, fontSize: 13, fontWeight: '700' },
    meta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  });
}
