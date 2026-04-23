import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { runAfterNavigationTransition } from '../utils/navigationTiming';
import { useTheme } from '../theme/ThemeContext';

const KEYS = {
  pushRide: 'farely_settings_push_ride',
  pushPromo: 'farely_settings_push_promo',
  emailReceipts: 'farely_settings_email_receipts',
};

const AppSettingsScreen = ({ navigation }) => {
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(), []);

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
      let cancelled = false;
      const cancelTransition = runAfterNavigationTransition(() => {
        if (cancelled) return;
        load();
      });
      return () => {
        cancelled = true;
        cancelTransition?.();
      };
    }, [load])
  );

  const persist = async (key, value) => {
    await AsyncStorage.setItem(key, value ? 'true' : 'false');
  };

  const ThemeChip = ({ label, value }) => {
    const on = mode === value;
    return (
      <TouchableOpacity
        onPress={() => setMode(value)}
        style={[
          styles.chip,
          {
            borderColor: on ? colors.accent : colors.border,
            backgroundColor: on ? colors.accentSoft : colors.surfaceElevated,
          },
        ]}
        activeOpacity={0.85}
      >
        <Text style={[styles.chipText, { color: on ? colors.accentSecondary : colors.textSecondary }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color={colors.accent} solid />
          <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>App settings</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.section, { color: colors.textMuted }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Theme</Text>
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
            Match system, or lock to light or dark. All main screens follow this choice.
          </Text>
          <View style={styles.chipRow}>
            <ThemeChip label="System" value="system" />
            <ThemeChip label="Light" value="light" />
            <ThemeChip label="Dark" value="dark" />
          </View>
        </View>

        <Text style={[styles.section, { color: colors.textMuted }]}>Notifications</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Ride updates</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Driver assigned, arrival, trip status
              </Text>
            </View>
            <Switch
              value={pushRide}
              onValueChange={(v) => {
                setPushRide(v);
                persist(KEYS.pushRide, v);
              }}
              trackColor={{ false: colors.border, true: colors.accentSoft }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Promotions & news</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Offers and product updates</Text>
            </View>
            <Switch
              value={pushPromo}
              onValueChange={(v) => {
                setPushPromo(v);
                persist(KEYS.pushPromo, v);
              }}
              trackColor={{ false: colors.border, true: colors.accentSoft }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
        </View>

        <Text style={[styles.section, { color: colors.textMuted }]}>Email & receipts</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Email trip summaries</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Optional summaries after rides you track in Farely (no in-app payments).
              </Text>
            </View>
            <Switch
              value={emailReceipts}
              onValueChange={(v) => {
                setEmailReceipts(v);
                persist(KEYS.emailReceipts, v);
              }}
              trackColor={{ false: colors.border, true: colors.accentSoft }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
        </View>

        <Text style={[styles.footerNote, { color: colors.textSecondary }]}>
          Push toggles are in-app preferences for this build. OS-level notifications still need permission in system
          settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AppSettingsScreen;

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
    title: { fontSize: 17, fontWeight: '900' },
    scroll: { padding: 16, paddingBottom: 32 },
    section: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8,
      marginTop: 4,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 16,
      overflow: 'hidden',
      padding: 14,
    },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
    rowLabel: { fontSize: 15, fontWeight: '800' },
    rowSub: { fontSize: 12, marginTop: 3, fontWeight: '600' },
    divider: { height: 1, marginVertical: 4 },
    footerNote: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipText: { fontWeight: '800', fontSize: 12 },
  });
}
