import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing } from '../constants/theme';

const ForgotPasswordSetNewScreen = ({ route, navigation }) => {
  const { identifier, channel } = route.params || {};
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { authApi, loadUser } = useContext(AuthContext);

  const handleSetupLater = () => {
    const routeNames = navigation.getState?.()?.routeNames || [];
    if (routeNames.includes('Main')) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Rides' } }],
      });
      return;
    }
    // Unauthenticated stack fallback: return to app entry/welcome instead of login.
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  const handleSave = async () => {
    const p = password.trim();
    const cp = confirmPassword.trim();
    if (!p || !cp) return alert('Please enter and confirm your new password.');
    if (p.length < 8) return alert('Password must be at least 8 characters.');
    if (p !== cp) return alert('Passwords do not match.');
    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        identifier,
        channel,
        password: p,
        confirmPassword: cp,
      });
      await AsyncStorage.setItem('token', res.data.token);
      await loadUser();
      navigation.navigate('Main', { screen: 'Rides' });
    } catch (err) {
      alert(err.response?.data?.message || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Set new password</Text>
        <Text style={styles.subtitle}>Enter your new password.</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter Your New Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryAction} onPress={handleSetupLater}>
            <Text style={styles.secondaryActionText}>Set up later...</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.eyeToggle} onPress={() => setShowPassword((s) => !s)}>
            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Allows 1 number or a special character.</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backArrow: { fontSize: 24, color: colors.gray700 },
  title: { fontSize: 20, fontWeight: '600', color: colors.gray900, marginBottom: spacing.sm },
  subtitle: { fontSize: 16, color: colors.gray500, marginBottom: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    padding: 14,
    borderRadius: 10,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  secondaryAction: { paddingVertical: 2 },
  secondaryActionText: { color: colors.gray500, fontSize: 14 },
  eyeToggle: { alignSelf: 'auto' },
  eyeText: { color: '#2563EB', fontSize: 14 },
  hint: { fontSize: 13, color: colors.gray500, marginBottom: spacing.xl },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});

export default ForgotPasswordSetNewScreen;
