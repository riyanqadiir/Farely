import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';

const OTP_LENGTH = 6;

const VerifyOtpScreen = ({ route, navigation }) => {
  const { identifier, channel, purpose } = route.params || {};
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);
  const { authApi } = useContext(AuthContext);

  useEffect(() => {
    const t = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const otpString = otp.join('');

  const handleChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (otpString.length !== OTP_LENGTH) {
      return alert('Please enter the 6-digit code.');
    }
    setLoading(true);
    try {
      const verifyApi =
        purpose === 'forgot_password' ? authApi.verifyForgotPasswordOtp : authApi.verifyOtp;
      await verifyApi({
        identifier,
        channel,
        purpose: purpose || 'signup',
        otp: otpString,
      });
      if (purpose === 'forgot_password') {
        navigation.navigate('ForgotPasswordSetNew', { identifier, channel });
      } else {
        const routeNames = navigation.getState?.()?.routeNames || [];
        if (routeNames.includes('SetPassword')) {
          navigation.navigate('SetPassword', { identifier, channel });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'CompleteProfile' }],
          });
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await authApi.resendOtp({ identifier, channel, purpose: purpose || 'signup' });
      setResendCooldown(60);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not resend code.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{channel === 'email' ? 'Email verification.' : 'Phone verification.'}</Text>
        <Text style={styles.subtitle}>Enter your OTP code.</Text>

        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(r) => (inputRefs.current[index] = r)}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(v) => handleChange(v, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.resendLink}
          onPress={handleResend}
          disabled={resendCooldown > 0}
        >
          <Text style={[styles.resendText, resendCooldown > 0 && styles.resendDisabled]}>
            {resendCooldown > 0
              ? `Resend again in ${resendCooldown}s`
              : "Didn't receive code? Resend again"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleVerify}
          disabled={loading || otpString.length !== OTP_LENGTH}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Verify</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  keyboardView: { flex: 1, padding: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backArrow: { fontSize: 24, color: colors.gray700 },
  title: { fontSize: 20, fontWeight: '600', color: colors.gray900, marginBottom: spacing.sm },
  subtitle: { fontSize: 16, color: colors.gray500, marginBottom: spacing.xl },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: colors.primary },
  resendLink: { marginBottom: spacing.xl },
  resendText: { color: colors.primary, fontSize: 15 },
  resendDisabled: { color: colors.gray500 },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});

export default VerifyOtpScreen;
