import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

const AboutScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>About</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.appName}>Farely</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
          <Text style={styles.body}>
            Farely is a ride-hailing simulation app for comparing fares, booking rides, tracking driver status, wallet
            top-ups, and in-app notifications — built for demos and academic projects (e.g. FYP).
          </Text>
        </View>

        <Text style={styles.section}>Legal</Text>
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

export default AboutScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 16, paddingBottom: 32 },
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 64 },
  backText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  title: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  appName: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  version: { marginTop: 4, color: '#64748b', fontWeight: '700' },
  body: { marginTop: 12, color: '#334155', lineHeight: 22, fontWeight: '600' },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
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

