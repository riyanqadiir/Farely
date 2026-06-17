import React, { useState, useMemo, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isValidPhoneNumber } from 'libphonenumber-js/mobile';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';
import { COUNTRIES, getDefaultCountry } from '../data/countries';
import AuthDivider from '../components/AuthDivider';

function fullPhone(phone, countryCode) {
  const p = String(phone).replace(/\D/g, '');
  const cc = (countryCode || '+92').replace(/\D/g, '');
  return (cc ? '+' + cc : '') + p;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value) {
  return EMAIL_REGEX.test((value || '').trim());
}

const SignupScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(getDefaultCountry());
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ name: '', email: '', phone: '' });
  const { authApi } = useContext(AuthContext);

  const filteredCountries = useMemo(() => {
    const q = (countrySearch || '').trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const validateForm = () => {
    const fullName = name.trim();
    const emailNorm = email.trim().toLowerCase();
    const phoneNorm = phone.replace(/\D/g, '');
    const next = { name: '', email: '', phone: '' };
    if (!fullName) next.name = 'Name is required.';
    if (!emailNorm) next.email = 'Email is required.';
    else if (!isValidEmail(emailNorm)) next.email = 'Please enter a valid email address.';
    if (!phoneNorm) next.phone = 'Mobile number is required.';
    else {
      const fullNumber = fullPhone(phoneNorm, selectedCountry.dialCode);
      if (!isValidPhoneNumber(fullNumber)) {
        next.phone = 'Please enter a valid phone number for ' + (selectedCountry.name || selectedCountry.dialCode) + '.';
      }
    }
    setErrors(next);
    return !next.name && !next.email && !next.phone;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;
    const fullName = name.trim();
    const emailNorm = email.trim().toLowerCase();
    const phoneNorm = phone.replace(/\D/g, '');
    setLoading(true);
    try {
      const res = await authApi.signup({
        fullName,
        email: emailNorm,
        phone: phoneNorm,
        countryCode: selectedCountry.dialCode || '+92',
        otpChannel: 'email',
      });
      const { data } = res;
      const channel = data.channel || 'email';
      const identifier = data.identifier ?? emailNorm;
      navigation.navigate('VerifyOtp', {
        identifier,
        channel,
        purpose: 'signup',
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Sign up failed.');
    } finally {
      setLoading(false);
    }
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

        <Text style={styles.headline}>Create your account</Text>
        <Text style={styles.subhead}>We’ll send a code to verify your email.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            placeholder="Your name"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setErrors((e) => ({ ...e, name: '' }));
            }}
            autoCapitalize="words"
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, errors.email ? styles.inputError : null]}
            placeholder="you@email.com"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setErrors((e) => ({ ...e, email: '' }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          <Text style={styles.label}>Mobile number</Text>
          <View style={styles.phoneFieldRow}>
            <TouchableOpacity
              style={[styles.countryCode, errors.phone ? styles.inputError : null]}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={styles.countryCodeText} numberOfLines={1}>
                {selectedCountry.dialCode}
              </Text>
              <Text style={styles.dropdown}>▼</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, styles.phoneInput, errors.phone ? styles.inputError : null]}
              placeholder="300 1234567"
              placeholderTextColor="#9ca3af"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setErrors((e) => ({ ...e, phone: '' }));
              }}
              keyboardType="phone-pad"
            />
          </View>
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

          <Text style={styles.terms}>
            By signing up, you agree to our{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('https://example.com/terms')}>
              Terms
            </Text>{' '}
            and{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('https://example.com/privacy')}>
              Privacy policy
            </Text>
            .
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign up</Text>
            )}
          </TouchableOpacity>
        </View>

        <AuthDivider label="More sign-up options coming soon" />

        <TouchableOpacity style={[styles.socialRow, styles.facebookRow]} disabled activeOpacity={0.7}>
          <FontAwesome6 name="facebook" size={20} color="#fff" brand />
          <Text style={styles.socialRowTextLight}>Facebook</Text>
          <View style={styles.soonPill}>
            <Text style={styles.soonPillText}>Soon</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.socialRow, styles.phoneSocialRow]} disabled activeOpacity={0.7}>
          <FontAwesome6 name="phone" size={18} color="#475569" solid />
          <Text style={styles.socialRowTextDark}>Phone only</Text>
          <View style={[styles.soonPill, styles.soonPillMuted]}>
            <Text style={styles.soonPillTextMuted}>Soon</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.footerMuted}>Already have an account? </Text>
          <Text style={styles.footerLink}>Sign in</Text>
        </TouchableOpacity>

        <Modal
          visible={showCountryPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowCountryPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCountryPicker(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Select country</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search country or code..."
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
              />
              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                style={styles.countryList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => {
                      setSelectedCountry(item);
                      setCountrySearch('');
                      setShowCountryPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemName}>{item.name}</Text>
                    <Text style={styles.pickerItemCode}>{item.dialCode}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No countries match your search.</Text>
                }
              />
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowCountryPicker(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
  inputError: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  errorText: { color: '#dc2626', fontSize: 13, marginTop: -8, marginBottom: spacing.sm },
  phoneFieldRow: { flexDirection: 'row', marginBottom: spacing.md, gap: 8 },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    borderRadius: 14,
    minWidth: 76,
    justifyContent: 'center',
  },
  countryCodeText: { fontSize: 16, color: colors.gray900, fontWeight: '600' },
  dropdown: { fontSize: 10, color: colors.gray500, marginLeft: 4 },
  phoneInput: { flex: 1, marginBottom: 0 },
  terms: { fontSize: 13, color: colors.gray500, lineHeight: 20, marginBottom: spacing.lg },
  link: { color: colors.primary, fontWeight: '600' },
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
  facebookRow: { backgroundColor: '#1877f2' },
  phoneSocialRow: {
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
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  pickerItemName: { fontSize: 16, color: colors.gray900 },
  pickerItemCode: { fontSize: 15, color: colors.gray500 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    borderRadius: 14,
    marginBottom: spacing.md,
    fontSize: 16,
    backgroundColor: '#f8fafc',
  },
  countryList: { maxHeight: 320 },
  emptyText: { padding: spacing.lg, textAlign: 'center', color: colors.gray500 },
  modalClose: { marginTop: spacing.md, padding: 14, alignItems: 'center' },
  modalCloseText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
});

export default SignupScreen;
