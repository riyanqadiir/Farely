import React, { useContext, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';

const MenuScreen = ({ navigation }) => {
  const { logout } = useContext(AuthContext);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(), []);

  const horizontalPad = useMemo(() => {
    if (windowWidth >= 900) return Math.max(24, (windowWidth - 640) / 2);
    if (windowWidth >= 600) return Math.max(20, (windowWidth - 560) / 2);
    return 16;
  }, [windowWidth]);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out of Farely?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const Section = ({ title, children }) => (
    <View style={styles.sectionWrap}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {children}
    </View>
  );

  const MenuRow = ({ icon, label, subtitle, onPress }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
    >
      <View style={styles.rowIconWrap}>
        <FontAwesome6 name={icon} size={16} color={colors.textSecondary} solid />
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowText, { color: colors.text }]}>{label}</Text>
        {!!subtitle && <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      <FontAwesome6 name="chevron-right" size={12} color={colors.textMuted} solid />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top, 12),
            paddingHorizontal: horizontalPad,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : navigation.navigate('Main', { screen: 'Rides' })
          }
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <FontAwesome6 name="chevron-left" size={14} color={colors.accent} solid />
          <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Menu</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: horizontalPad,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Farely compares Yango and Bykea side by side. Book and pay only inside the provider you choose.
        </Text>

        <Section title="Account">
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <MenuRow
              icon="user"
              label="Profile"
              subtitle="Name, photo, city & address"
              onPress={() => navigation.push('MenuProfile', { fromMenu: true })}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuRow
              icon="shield"
              label="Account & security"
              subtitle="Password and sign-in"
              onPress={() => navigation.push('AccountSettings')}
            />
          </View>
        </Section>

        <Section title="Preferences">
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <MenuRow
              icon="bell"
              label="Notifications"
              subtitle="Ride and product updates"
              onPress={() => navigation.push('Notification')}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuRow
              icon="sliders"
              label="App settings"
              subtitle="Appearance, email receipts, toggles"
              onPress={() => navigation.push('AppSettings')}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuRow
              icon="clock-rotate-left"
              label="Ride history"
              subtitle="Confirmed rides after provider return"
              onPress={() => navigation.push('RideHistory')}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuRow
              icon="clipboard-check"
              label="Pending ride reviews"
              subtitle="Confirm rides you skipped for later"
              onPress={() => navigation.push('RideReview')}
            />
          </View>
        </Section>

        <Section title="Help & legal">
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <MenuRow
              icon="star"
              label="Send feedback"
              subtitle="Rate the app and how Farely helps you"
              onPress={() => navigation.push('Feedback', { source: 'menu' })}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuRow
              icon="comments"
              label="Help & support"
              subtitle="FAQ and contact"
              onPress={() => navigation.push('HelpSupport')}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuRow
              icon="circle-info"
              label="About Farely"
              subtitle="Version and product summary"
              onPress={() => navigation.push('About')}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuRow
              icon="file-lines"
              label="Terms of service"
              onPress={() => navigation.push('Terms')}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MenuRow
              icon="lock"
              label="Privacy policy"
              subtitle="How we use your data"
              onPress={() => navigation.push('PrivacyPolicy')}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.logoutRow}
              onPress={handleLogout}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Log out. Sign out on this device"
            >
              <View style={styles.rowIconWrap}>
                <FontAwesome6 name="right-from-bracket" size={16} color={colors.danger} solid />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={[styles.logoutLabel, { color: colors.danger }]}>Log out</Text>
                <Text style={[styles.logoutSub, { color: colors.textMuted }]}>
                  Sign out on this device
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MenuScreen;

function createStyles() {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      paddingBottom: 14,
      borderBottomWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 48,
      minHeight: 48,
      justifyContent: 'flex-start',
      paddingRight: 8,
    },
    headerSpacer: { width: 48 },
    backText: { fontWeight: '800', fontSize: 12 },
    title: { fontSize: 18, fontWeight: '900', flex: 1, textAlign: 'center' },
    scroll: { paddingTop: 16 },
    intro: {
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '600',
      marginBottom: 16,
    },
    sectionWrap: { marginBottom: 18 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 10,
    },
    rowIconWrap: { width: 28, alignItems: 'center' },
    rowTextWrap: { flex: 1 },
    rowText: { fontSize: 15, fontWeight: '800' },
    rowSub: { fontSize: 12, fontWeight: '600', marginTop: 3 },
    divider: { height: 1, marginLeft: 50 },
    logoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 10,
    },
    logoutLabel: { fontSize: 15, fontWeight: '800' },
    logoutSub: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  });
}
