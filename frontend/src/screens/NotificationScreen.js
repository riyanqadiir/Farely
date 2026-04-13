import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useFocusEffect } from '@react-navigation/native';
import { getAppNotifications } from '../utils/notifications';
import { runAfterNavigationTransition } from '../utils/navigationTiming';

const FALLBACK_ITEMS = [
  {
    id: 'seed-1',
    title: 'Welcome to Farely',
    body: 'Ride updates, driver status and wallet transactions will appear here.',
    createdAt: new Date().toISOString(),
  },
];

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function relativeTime(iso) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  return 'Yesterday';
}

const Section = ({ title, items }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {items.map((n) => (
      <View key={n.id} style={styles.card}>
        <View style={styles.cardTop}>
          <FontAwesome6 name="bell" size={14} color="#ffffff" solid />
          <Text style={styles.cardTitle}>{n.title}</Text>
        </View>
        <Text style={styles.cardBody}>{n.body}</Text>
        <Text style={styles.cardTime}>{n.time}</Text>
      </View>
    ))}
  </View>
);

const NotificationScreen = ({ navigation }) => {
  const [items, setItems] = useState(FALLBACK_ITEMS);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (fromPull = false) => {
    if (fromPull) setRefreshing(true);
    try {
      const data = await getAppNotifications();
      setItems(data.length ? data : FALLBACK_ITEMS);
    } finally {
      if (fromPull) setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const cancelTransition = runAfterNavigationTransition(() => {
        if (cancelled) return;
        load(false);
      });
      return () => {
        cancelled = true;
        cancelTransition?.();
      };
    }, [load])
  );

  const { todayItems, yesterdayItems, earlierItems } = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const today = [];
    const yday = [];
    const earlier = [];
    for (const item of items) {
      const at = new Date(item.createdAt || Date.now());
      if (isSameDay(at, now)) today.push(item);
      else if (isSameDay(at, yesterday)) yday.push(item);
      else earlier.push(item);
    }
    return { todayItems: today, yesterdayItems: yday, earlierItems: earlier };
  }, [items]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <FontAwesome6 name="chevron-left" size={16} color="#2563eb" solid />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Notifications</Text>

          <View style={{ width: 90 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
          }
        >
          <Section
            title="Today"
            items={todayItems.map((n) => ({ ...n, time: relativeTime(n.createdAt) }))}
          />
          <Section
            title="Yesterday"
            items={yesterdayItems.map((n) => ({ ...n, time: relativeTime(n.createdAt) }))}
          />
          <Section
            title="Earlier"
            items={earlierItems.map((n) => ({ ...n, time: relativeTime(n.createdAt) }))}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default NotificationScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtnText: { color: '#2563eb', fontWeight: '800' },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '900', color: '#0f172a', fontSize: 18 },
  scrollContent: { padding: 16, paddingBottom: 28 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#2563eb', marginBottom: 10 },
  card: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  cardBody: { color: '#e0e7ff', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  cardTime: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
});

