import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

const BODY = `
Last updated: April 2026

This Privacy Policy describes how Farely (“we”, “us”) handles information when you use our mobile application.

1. Information we collect

• Account data: name, email, phone number, and profile details you provide during signup or profile completion.
• Location data: when you grant permission, we use device location to show the map, pickup/destination, and route estimates.
• Usage data: app interactions such as ride searches, provider handoffs, ride confirmations, and notification events stored for in-app history.
• Device data: basic technical information needed for the app to run (e.g. OS version) where applicable.

2. How we use information

• To provide core features: ride comparison, provider handoff, return confirmation, ride history, and notifications.
• To improve safety and reliability: troubleshooting, fraud prevention in production systems.
• To communicate with you: OTP, receipts (if enabled), and support responses.

3. Local and demo storage

Some features (e.g. notification history and pending provider-return confirmations) may be stored on your device to keep experience smooth after app switching.

4. Sharing

We do not sell your personal information. We may share data with service providers strictly necessary to operate the app (e.g. maps, SMS/email providers) under appropriate agreements.

5. Your choices

• Location: you can disable location in system settings; some features will not work without it.
• Notifications: adjust preferences in App settings where available.
• Account: update profile data in Profile; contact support to request account-related assistance.

6. Data retention

We retain information as long as your account is active and as needed for legal or operational purposes. Device-only demo data is removed if you clear app storage.

7. Children

The App is not directed at children under 13. Do not register if you are under the applicable minimum age.

8. Changes

We may update this policy. Continued use after changes means you accept the updated policy.

9. Contact

Privacy questions: privacy@farely.app
Support: support@farely.app
Rider website: https://farely-web.vercel.app/
`.trim();

const PrivacyPolicyScreen = ({ navigation }) => (
  <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Privacy policy</Text>
      <View style={{ width: 64 }} />
    </View>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.body}>{BODY}</Text>
    </ScrollView>
  </SafeAreaView>
);

export default PrivacyPolicyScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 88 },
  backText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  title: { fontSize: 16, fontWeight: '900', color: '#0f172a', flex: 1, textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  body: { fontSize: 14, color: '#334155', lineHeight: 22, fontWeight: '600' },
});
