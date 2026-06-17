import React, { useState, useContext } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import { colors, spacing } from '../constants/theme';

const ForgotPasswordSetNewScreen = ({ route, navigation }) => {
  const { identifier, channel } = route.params || {};
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { authApi } = useContext(AuthContext);

  const goToLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
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
      await authApi.resetPassword({
        identifier,
        channel,
        password: p,
        confirmPassword: cp,
      });
      goToLogin();
      setTimeout(
        () => alert('Password updated. Sign in with your new password.'),
        400
      );
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

        <PasswordInput
          placeholder="Enter Your New Password"
          value={password}
          onChangeText={setPassword}
          visible={showPassword}
          onToggleVisible={() => setShowPassword((s) => !s)}
          containerStyle={styles.field}
          inputStyle={styles.inputPlain}
        />
        <PasswordInput
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          visible={showPassword}
          onToggleVisible={() => setShowPassword((s) => !s)}
          containerStyle={styles.field}
          inputStyle={styles.inputPlain}
        />
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
  field: { marginBottom: spacing.md },
  inputPlain: {
    borderColor: colors.gray300,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    paddingRight: 48,
  },
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
