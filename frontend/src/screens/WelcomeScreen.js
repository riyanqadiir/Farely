import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../constants/theme';

const WelcomeScreen = ({ navigation }) => (
  <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <View style={styles.content}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Have a better sharing experience.</Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('Signup')}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Create an account</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('Login')}
        activeOpacity={0.8}
      >
        <Text style={styles.secondaryButtonText}>Log in</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.xl, alignItems: 'center' },
  title: { ...typography.headline, fontSize: 32, color: colors.gray900, marginBottom: spacing.sm },
  subtitle: { fontSize: 16, color: colors.gray500, marginBottom: spacing.xxl },
  primaryButton: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  secondaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  secondaryButtonText: { color: colors.gray700, fontSize: 18, fontWeight: '600' },
});

export default WelcomeScreen;
