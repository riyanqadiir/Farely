import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AuthDivider({ label = 'or' }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.line} />
      <Text style={styles.text}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#cbd5e1' },
  text: {
    marginHorizontal: 14,
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
});
