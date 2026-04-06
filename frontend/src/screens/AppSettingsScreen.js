import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const KEYS = {
  pushRide: 'farely_settings_push_ride',
  pushPromo: 'farely_settings_push_promo',
  emailReceipts: 'farely_settings_email_receipts',
};

const AppSettingsScreen = ({ navigation }) => {
  const [pushRide, setPushRide] = useState(true);
  const [pushPromo, setPushPromo] = useState(false);
  const [emailReceipts, setEmailReceipts] = useState(true);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      AsyncStorage.getItem(KEYS.pushRide),
      AsyncStorage.getItem(KEYS.pushPromo),
      AsyncStorage.getItem(KEYS.emailReceipts),
    ]);
    if (a !== null) setPushRide(a === 'true');
    if (b !== null) setPushPromo(b === 'true');
    if (c !== null) setEmailReceipts(c === 'true');
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const persist = async (key, value) => {
    await AsyncStorage.setItem(key, value ? 'true' : 'false');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>App settings</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Ride updates</Text>
              <Text style={styles.rowSub}>Driver assigned, arrival, trip status</Text>
            </View>
            <Switch
              value={pushRide}
              onValueChange={(v) => {
                setPushRide(v);
                persist(KEYS.pushRide, v);
              }}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Promotions & news</Text>
              <Text style={styles.rowSub}>Offers and product updates</Text>
            </View>
            <Switch
              value={pushPromo}
              onValueChange={(v) => {
                setPushPromo(v);
                persist(KEYS.pushPromo, v);
              }}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
            />
          </View>
        </View>

        <Text style={styles.section}>Payments & receipts</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Email trip receipts</Text>
              <Text style={styles.rowSub}>Send a receipt after each completed ride</Text>
            </View>
            <Switch
              value={emailReceipts}
              onValueChange={(v) => {
                setEmailReceipts(v);
                persist(KEYS.emailReceipts, v);
              }}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
            />
          </View>
        </View>

        <Text style={styles.footerNote}>
          Push notification toggles control in-app preferences for this build. Full OS-level notifications require
          device permission in system settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AppSettingsScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 88 },
  backText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  title: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 32 },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowLabel: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  rowSub: { fontSize: 12, color: '#64748b', marginTop: 3, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f1f5f9' },
  footerNote: { fontSize: 12, color: '#64748b', lineHeight: 18, fontWeight: '600' },
});
