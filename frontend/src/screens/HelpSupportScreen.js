import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

const FAQ = [
  {
    q: 'How are fares calculated?',
    a: 'Fares combine a base rate for your vehicle type, distance, and provider-specific pricing. Estimates shown before booking are indicative and may differ slightly from the final charge.',
  },
  {
    q: 'How do I pay?',
    a: 'You can pay with wallet balance, cash, or a saved card where available. Add cards under Menu → Payment methods.',
  },
  {
    q: 'Who do I contact for a lost item?',
    a: 'Email support@farely.app with your trip time, pickup and drop-off, and a description of the item. We will coordinate with the driver when possible.',
  },
];

const HelpSupportScreen = ({ navigation }) => {
  const [open, setOpen] = useState(0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Help & support</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => Linking.openURL('mailto:support@farely.app?subject=Farely%20support')}
          activeOpacity={0.85}
        >
          <FontAwesome6 name="envelope" size={18} color="#2563eb" solid />
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Email us</Text>
            <Text style={styles.contactSub}>support@farely.app</Text>
          </View>
          <FontAwesome6 name="chevron-right" size={12} color="#94a3b8" solid />
        </TouchableOpacity>

        <Text style={styles.section}>Common questions</Text>
        {FAQ.map((item, i) => (
          <View key={item.q} style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqHead}
              onPress={() => setOpen(open === i ? -1 : i)}
              activeOpacity={0.85}
            >
              <Text style={styles.faqQ}>{item.q}</Text>
              <FontAwesome6 name={open === i ? 'chevron-up' : 'chevron-down'} size={12} color="#64748b" solid />
            </TouchableOpacity>
            {open === i && <Text style={styles.faqA}>{item.a}</Text>}
          </View>
        ))}

        <Text style={styles.section}>More</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Terms')}>
          <Text style={styles.linkText}>Terms of service</Text>
          <FontAwesome6 name="chevron-right" size={12} color="#94a3b8" solid />
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.linkText}>Privacy policy</Text>
          <FontAwesome6 name="chevron-right" size={12} color="#94a3b8" solid />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HelpSupportScreen;

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
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 20,
  },
  contactTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  contactSub: { fontSize: 13, color: '#2563eb', fontWeight: '700', marginTop: 2 },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0f172a' },
  faqA: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 8,
  },
  linkText: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
});
