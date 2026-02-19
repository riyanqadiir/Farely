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
import { colors, spacing } from '../constants/theme';

const LoginScreen = ({ navigation }) => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, googleSignIn } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!loginId || !password) return alert('Please fill all fields');
    setLoading(true);
    const res = await login(loginId, password);
    setLoading(false);
    if (!res.success) alert(res.msg);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const res = await googleSignIn();
    setGoogleLoading(false);
    if (!res.success) alert(res.msg);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sign in with your email or phone number.</Text>

        <TouchableOpacity
          style={[styles.socialButton, styles.googleButton]}
          onPress={handleGoogleLogin}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.socialButtonText}>Sign in with Google</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.socialButton, styles.outlineButton]} disabled>
          <Text style={styles.socialButtonTextOutline}>Sign in with Facebook</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.socialButton, styles.outlineButton]} disabled>
          <Text style={styles.socialButtonTextOutline}>Sign in with Phone</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Email or Phone Number"
          value={loginId}
          onChangeText={setLoginId}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Enter your Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => navigation.navigate('ForgotPasswordSend')}
        >
          <Text style={styles.forgotLinkText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.footerLinkText}>Don't have an account? Sign Up</Text>
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.lg,
  },
  socialButton: { padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: spacing.sm },
  googleButton: { backgroundColor: '#4285f4' },
  outlineButton: { borderWidth: 1, borderColor: colors.gray300 },
  socialButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  socialButtonTextOutline: { color: colors.gray700, fontSize: 16, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    padding: 14,
    borderRadius: 10,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  forgotLink: { alignSelf: 'flex-end', marginBottom: spacing.lg },
  forgotLinkText: { color: '#ef4444', fontSize: 14 },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  footerLink: { alignItems: 'center' },
  footerLinkText: { color: colors.primary, fontSize: 15 },
});

export default LoginScreen;
