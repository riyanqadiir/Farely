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
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';
import AuthDivider from '../components/AuthDivider';

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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backCircle}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headline}>Welcome back</Text>
        <Text style={styles.subhead}>Sign in with email or phone and password.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email or phone</Text>
          <TextInput
            style={styles.input}
            placeholder="you@email.com or +92…"
            placeholderTextColor="#9ca3af"
            value={loginId}
            onChangeText={setLoginId}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => navigation.navigate('ForgotPasswordSend')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </View>

        <AuthDivider label="Or continue with" />

        <TouchableOpacity
          style={[styles.socialRow, styles.googleRow]}
          onPress={handleGoogleLogin}
          disabled={googleLoading}
          activeOpacity={0.85}
        >
          {googleLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome6 name="google" size={20} color="#fff" brand />
              <Text style={styles.socialRowTextLight}>Google</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.socialRow, styles.facebookRow]} disabled activeOpacity={0.7}>
          <FontAwesome6 name="facebook" size={20} color="#fff" brand />
          <Text style={styles.socialRowTextLight}>Facebook</Text>
          <View style={styles.soonPill}>
            <Text style={styles.soonPillText}>Soon</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.socialRow, styles.phoneRow]} disabled activeOpacity={0.7}>
          <FontAwesome6 name="phone" size={18} color="#475569" solid />
          <Text style={styles.socialRowTextDark}>Phone OTP</Text>
          <View style={[styles.soonPill, styles.soonPillMuted]}>
            <Text style={styles.soonPillTextMuted}>Soon</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerBtn} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.footerMuted}>New here? </Text>
          <Text style={styles.footerLink}>Create an account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  backCircle: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  backArrow: { fontSize: 22, color: colors.gray700 },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subhead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray500,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.gray900,
  },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: spacing.lg, marginTop: -4 },
  forgotText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  googleRow: { backgroundColor: '#4285f4' },
  facebookRow: { backgroundColor: '#1877f2' },
  phoneRow: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  socialRowTextLight: { color: '#fff', fontSize: 16, fontWeight: '700' },
  socialRowTextDark: { color: '#334155', fontSize: 16, fontWeight: '700' },
  soonPill: {
    position: 'absolute',
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  soonPillText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  soonPillMuted: { backgroundColor: '#f1f5f9' },
  soonPillTextMuted: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  footerBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: 8,
  },
  footerMuted: { fontSize: 15, color: colors.gray500 },
  footerLink: { fontSize: 15, fontWeight: '700', color: colors.primary },
});

export default LoginScreen;
