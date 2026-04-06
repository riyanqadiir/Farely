import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { navigationRef } from '../navigation/rootNavigation';
import { AuthContext } from '../context/AuthContext';

/** Root stack lives on NavigationContainer; local `navigation` from Menu can miss sibling routes on some builds. */
function goTo(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

const Section = ({ title, children }) => (
  <View style={styles.sectionWrap}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const MenuRow = ({ icon, label, subtitle, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.rowIconWrap}>
      <FontAwesome6 name={icon} size={16} color="#334155" solid />
    </View>
    <View style={styles.rowTextWrap}>
      <Text style={styles.rowText}>{label}</Text>
      {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
    </View>
    <FontAwesome6 name="chevron-right" size={12} color="#94a3b8" solid />
  </TouchableOpacity>
);

const MenuScreen = () => {
  const { logout } = useContext(AuthContext);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out of Farely?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goTo('Main', { screen: 'Rides' })} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Menu</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Account, payments, preferences, and legal — same structure as major ride apps.</Text>

        <Section title="Account">
          <View style={styles.card}>
            <MenuRow
              icon="user"
              label="Profile"
              subtitle="Name, photo, city & address"
              onPress={() => goTo('Main', { screen: 'Profile', params: { fromMenu: true } })}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="shield"
              label="Account & security"
              subtitle="Password, sign-in, payment shortcuts"
              onPress={() => goTo('AccountSettings')}
            />
          </View>
        </Section>

        <Section title="Payments">
          <View style={styles.card}>
            <MenuRow
              icon="wallet"
              label="Wallet"
              subtitle="Balance, top-up, trip history"
              onPress={() => goTo('Main', { screen: 'Wallet', params: { fromMenu: true } })}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="credit-card"
              label="Payment methods"
              subtitle="Cards on file, default card"
              onPress={() => goTo('PaymentMethods')}
            />
          </View>
        </Section>

        <Section title="Preferences">
          <View style={styles.card}>
            <MenuRow
              icon="bell"
              label="Notifications"
              subtitle="Ride and transaction alerts"
              onPress={() => goTo('Notification')}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="sliders"
              label="App settings"
              subtitle="Push, receipts, preferences"
              onPress={() => goTo('AppSettings')}
            />
          </View>
        </Section>

        <Section title="Help & legal">
          <View style={styles.card}>
            <MenuRow
              icon="comments"
              label="Help & support"
              subtitle="FAQ, contact, links to policies"
              onPress={() => goTo('HelpSupport')}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="circle-info"
              label="About Farely"
              subtitle="Version, what the app does"
              onPress={() => goTo('About')}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="file-lines"
              label="Terms of service"
              onPress={() => goTo('Terms')}
            />
            <View style={styles.divider} />
            <MenuRow
              icon="lock"
              label="Privacy policy"
              subtitle="How we use your data"
              onPress={() => goTo('PrivacyPolicy')}
            />
            <View style={styles.divider} />
            <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.85}>
              <View style={styles.rowIconWrap}>
                <FontAwesome6 name="right-from-bracket" size={16} color="#dc2626" solid />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.logoutLabel}>Log out</Text>
                <Text style={styles.logoutSub}>Sign out of your account on this device</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MenuScreen;

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
  title: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 32 },
  intro: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionWrap: { marginBottom: 18 },
  sectionTitle: {
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
  rowText: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  rowSub: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 3 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginLeft: 50 },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  logoutLabel: { fontSize: 15, fontWeight: '800', color: '#dc2626' },
  logoutSub: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 3 },
});
