import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../constants/theme';

/**
 * Account identifiers (email / phone) are set at signup and cannot be edited on profile screens.
 */
export default function ReadOnlyProfileField({
  label,
  value,
  hint = 'Set at registration and cannot be changed here.',
  themeColors,
}) {
  const borderColor = themeColors?.border ?? colors.gray300;
  const textColor = themeColors?.text ?? colors.gray900;
  const muted = themeColors?.textMuted ?? colors.gray500;
  const bg = themeColors?.chipInactive ?? colors.gray100;

  return (
    <View style={[styles.wrap, { borderColor, backgroundColor: bg }]}>
      <Text style={[styles.label, { color: muted }]}>{label}</Text>
      <Text style={[styles.value, { color: textColor }]} numberOfLines={2}>
        {value?.trim() ? value.trim() : '—'}
      </Text>
      <Text style={[styles.hint, { color: muted }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
  },
});
