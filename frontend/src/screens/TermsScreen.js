import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

const BODY = `
Last updated: April 2026

1. Acceptance
By using Farely (“the App”), you agree to these Terms of Service. If you do not agree, do not use the App.

2. Service description
Farely provides tools to compare ride options, view estimates, book simulated rides, manage a wallet, and receive in-app notifications. Features may change for testing, demonstration, or academic purposes (e.g. FYP projects).

3. Accounts
You are responsible for your login credentials and for activity under your account. You must provide accurate profile information where requested.

4. Payments
Fare amounts shown are estimates unless stated otherwise. Final charges may depend on the provider’s app or policies. Wallet and card features in the App may use demo or local storage; production deployments must integrate compliant payment processors.

5. Prohibited use
You may not misuse the App, attempt unauthorized access, reverse engineer except as permitted by law, or use the App in violation of applicable law in Pakistan or your jurisdiction.

6. Limitation of liability
The App is provided “as is.” To the maximum extent permitted by law, Farely and its operators are not liable for indirect or consequential damages arising from use of the App.

7. Contact
For questions about these terms, contact farely.support@gmail.com.
`.trim();

const TermsScreen = ({ navigation }) => (
  <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Terms of service</Text>
      <View style={{ width: 64 }} />
    </View>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.body}>{BODY}</Text>
    </ScrollView>
  </SafeAreaView>
);

export default TermsScreen;

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
