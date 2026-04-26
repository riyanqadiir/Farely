import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useFocusEffect } from '@react-navigation/native';
import { getAppNotifications } from '../utils/notifications';
import { runAfterNavigationTransition } from '../utils/navigationTiming';
import { useTheme } from '../theme/ThemeContext';

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

const Section = ({ title, items, colors, styles }) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.accentSecondary }]}>{title}</Text>
    {items.map((n) => (
      <View key={n.id} style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBadge, { backgroundColor: colors.accent }]}>
            <FontAwesome6 name="bell" size={12} color={colors.onAccent} solid />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{n.title}</Text>
        </View>
        <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{n.body}</Text>
        <Text style={[styles.cardTime, { color: colors.textMuted }]}>{n.time}</Text>
      </View>
    ))}
  </View>
);

const NotificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(), []);
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
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <FontAwesome6 name="chevron-left" size={16} color={colors.accent} solid />
            <Text style={[styles.backBtnText, { color: colors.accent }]}>Back</Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>

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
            colors={colors}
            styles={styles}
          />
          <Section
            title="Yesterday"
            items={yesterdayItems.map((n) => ({ ...n, time: relativeTime(n.createdAt) }))}
            colors={colors}
            styles={styles}
          />
          <Section
            title="Earlier"
            items={earlierItems.map((n) => ({ ...n, time: relativeTime(n.createdAt) }))}
            colors={colors}
            styles={styles}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default NotificationScreen;

function createStyles() {
  return StyleSheet.create({
    safe: { flex: 1 },
    container: { flex: 1 },
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
    backBtnText: { fontWeight: '800' },
    headerTitle: { flex: 1, textAlign: 'center', fontWeight: '900', fontSize: 18 },
    scrollContent: { padding: 16, paddingBottom: 28 },
    section: { marginBottom: 18 },
    sectionTitle: { fontSize: 14, fontWeight: '900', marginBottom: 10 },
    card: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    iconBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 14, fontWeight: '900' },
    cardBody: { fontSize: 12, lineHeight: 18, marginBottom: 8, fontWeight: '600' },
    cardTime: { fontSize: 11, fontWeight: '700' },
  });
}

