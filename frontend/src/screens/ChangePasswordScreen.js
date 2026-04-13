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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';

const ChangePasswordScreen = ({ navigation }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const { authApi, loadUser } = useContext(AuthContext);

  const handleSubmit = async () => {
    const c = currentPassword.trim();
    const n = newPassword.trim();
    const cn = confirmNewPassword.trim();
    if (!c || !n || !cn) return alert('Please fill in all fields.');
    if (n.length < 8) return alert('New password must be at least 8 characters.');
    if (n !== cn) return alert('New password and confirmation do not match.');
    setLoading(true);
    try {
      const res = await authApi.changePassword({
        currentPassword: c,
        newPassword: n,
        confirmNewPassword: cn,
      });
      const token = res.data?.token;
      if (token) await AsyncStorage.setItem('token', token);
      await loadUser?.();
      alert('Password updated successfully.');
      navigation.goBack();
    } catch (err) {
      const msg =
        err.response?.data?.message
        || err.response?.data?.errors?.[0]?.msg
        || 'Could not change password.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Change password</Text>
        <Text style={styles.subtitle}>
          Enter your current password, then choose a new one. This is separate from “Forgot password” (no OTP
          here).
        </Text>

        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          placeholder="Current password"
          placeholderTextColor="#9ca3af"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry={!showCurrent}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.eyeToggle} onPress={() => setShowCurrent((s) => !s)}>
          <Text style={styles.eyeText}>{showCurrent ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor="#9ca3af"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showNew}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#9ca3af"
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          secureTextEntry={!showNew}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.eyeToggle} onPress={() => setShowNew((s) => !s)}>
          <Text style={styles.eyeText}>{showNew ? 'Hide' : 'Show'} new fields</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>Use at least 8 characters with uppercase, lowercase, and a number.</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Update password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ChangePasswordScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xl * 2 },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backArrow: { fontSize: 24, color: colors.gray700 },
  title: { fontSize: 20, fontWeight: '600', color: colors.gray900, marginBottom: spacing.sm },
  subtitle: { fontSize: 14, color: colors.gray500, marginBottom: spacing.lg, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    padding: 14,
    borderRadius: 10,
    marginBottom: spacing.sm,
    fontSize: 16,
  },
  eyeToggle: { alignSelf: 'flex-end', marginBottom: spacing.md },
  eyeText: { color: colors.primary, fontSize: 14 },
  hint: { fontSize: 13, color: colors.gray500, marginBottom: spacing.xl },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
