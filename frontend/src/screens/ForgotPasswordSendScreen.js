import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';

const ForgotPasswordSendScreen = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const { authApi } = useContext(AuthContext);

  const handleSendOtp = async () => {
    const id = identifier.trim();
    if (!id) return alert('Please enter your email or phone number.');
    const channel = id.includes('@') ? 'email' : 'phone';
    setLoading(true);
    try {
      await authApi.forgotPassword({ channel, identifier: id });
      const normId = channel === 'email' ? id.trim().toLowerCase() : id.trim();
      navigation.navigate('VerifyOtp', {
        identifier: normId,
        channel,
        purpose: 'forgot_password',
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Could not send verification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Verification email or phone number.</Text>
      <TextInput
        style={styles.input}
        placeholder="Email or phone number"
        value={identifier}
        onChangeText={setIdentifier}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Send OTP</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backArrow: { fontSize: 24, color: colors.gray700 },
  title: { fontSize: 20, fontWeight: '600', color: colors.gray900, marginBottom: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    padding: 14,
    borderRadius: 10,
    marginBottom: spacing.xl,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});

export default ForgotPasswordSendScreen;
