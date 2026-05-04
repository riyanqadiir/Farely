import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

const PRIMARY = colors.primary;

/**
 * Placeholder illustrations for onboarding slides.
 * Replace with actual image assets when ready (e.g. require('../assets/onboarding/slide1.png'))
 */
export const Slide1Illustration = () => (
  <View style={styles.container}>
    <View style={[styles.car, styles.carMain]} />
    <View style={[styles.map, styles.mapMain]}>
      <View style={styles.pin} />
    </View>
    <View style={[styles.person, styles.personStanding]} />
  </View>
);

export const Slide2Illustration = () => (
  <View style={styles.container}>
    <View style={[styles.car, styles.carHood]} />
    <View style={[styles.person, styles.personSitting]} />
    <View style={[styles.phone, styles.phoneMap]}>
      <View style={styles.pin} />
    </View>
    <View style={[styles.pinLarge, styles.pinBg]} />
  </View>
);

export const Slide3Illustration = () => (
  <View style={styles.container}>
    <View style={[styles.car, styles.carIsometric]} />
    <View style={[styles.person, styles.personEntering]} />
  </View>
);

const styles = StyleSheet.create({
  container: { width: 280, height: 220, alignSelf: 'center', position: 'relative' },
  car: { backgroundColor: PRIMARY, borderRadius: 12, opacity: 0.9 },
  carMain: { width: 160, height: 70, position: 'absolute', bottom: 20, left: 20 },
  carHood: { width: 180, height: 60, position: 'absolute', bottom: 30, left: 50 },
  carIsometric: { width: 200, height: 90, position: 'absolute', bottom: 30, left: 40 },
  map: { backgroundColor: `${PRIMARY}20`, borderRadius: 12, borderWidth: 2, borderColor: `${PRIMARY}40` },
  mapMain: { width: 120, height: 100, position: 'absolute', top: 10, right: 30 },
  phone: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 2, borderColor: PRIMARY },
  phoneMap: { width: 80, height: 100, position: 'absolute', bottom: 60, right: 40 },
  pin: { width: 24, height: 24, borderRadius: 12, backgroundColor: PRIMARY, alignSelf: 'center', marginTop: 20 },
  pinLarge: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${PRIMARY}40`, position: 'absolute', top: 30, right: 60 },
  pinBg: { opacity: 0.6 },
  person: { width: 40, height: 60, backgroundColor: PRIMARY, borderRadius: 20 },
  personStanding: { position: 'absolute', bottom: 30, left: 100 },
  personSitting: { position: 'absolute', bottom: 50, left: 80, transform: [{ rotate: '-10deg' }] },
  personEntering: { position: 'absolute', bottom: 35, left: 130, width: 35, height: 55 },
});
