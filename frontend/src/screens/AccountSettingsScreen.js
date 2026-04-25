import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { AuthContext } from '../context/AuthContext';

const Row = ({ icon, label, subtitle, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.rowIconWrap}>
      <FontAwesome6 name={icon} size={16} color="#334155" solid />
    </View>
    <View style={styles.rowTextWrap}>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
    </View>
    <FontAwesome6 name="chevron-right" size={12} color="#94a3b8" solid />
  </TouchableOpacity>
);

const AccountSettingsScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const email = user?.email || '—';
  const phone = user?.phone || user?.loginId || '—';
  const openMenuProfile = () => navigation.navigate('MenuProfile');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Account & security</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <Row
            icon="user"
            label="Profile"
            subtitle="Name, photo, address"
            onPress={openMenuProfile}
          />
          <View style={styles.divider} />
          <Row
            icon="envelope"
            label="Email & phone"
            subtitle={`${email} · ${phone}`}
            onPress={openMenuProfile}
          />
        </View>

        <Text style={styles.section}>Security</Text>
        <View style={styles.card}>
          <Row
            icon="key"
            label="Change password"
            subtitle="Current password and new password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
        </View>

        <Text style={styles.note}>
          Change password (signed in) uses your current password. If you are signed out, use Forgot password on
          the login screen — that flow uses email or phone OTP and is a separate API.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountSettingsScreen;

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
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 6,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  rowIconWrap: { width: 28, alignItems: 'center' },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  rowSub: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 3 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginLeft: 50 },
  note: {
    marginTop: 16,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    fontWeight: '600',
  },
});
