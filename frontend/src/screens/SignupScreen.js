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
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../constants/theme';
import { COUNTRIES, getDefaultCountry } from '../data/countries';

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({ name: '', email: '', phone: '' });
  const { authApi, googleSignIn } = useContext(AuthContext);

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
        otpChannel: 'phone',
      });
      const { data } = res;
      const channel = data.channel || 'phone';
      const identifier =
        data.identifier ?? (channel === 'email' ? emailNorm : fullPhone(phoneNorm, selectedCountry.dialCode));
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

  const handleGoogleSignUp = async () => {
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
        <Text style={styles.title}>Sign up with your email or phone number.</Text>

        <TextInput
          style={[styles.input, errors.name ? styles.inputError : null]}
          placeholder="Name"
          value={name}
          onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: '' })); }}
          autoCapitalize="words"
        />
        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        <TextInput
          style={[styles.input, errors.email ? styles.inputError : null]}
          placeholder="Email"
          value={email}
          onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
        <View style={styles.phoneRow}>
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
            placeholder="Mobile number"
            value={phone}
            onChangeText={(t) => { setPhone(t); setErrors((e) => ({ ...e, phone: '' })); }}
            keyboardType="phone-pad"
          />
        </View>
        {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

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
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowCountryPicker(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Text style={styles.terms}>
          By signing up, you agree to the{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://example.com/terms')}>
            Terms of service
          </Text>{' '}
          and{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://example.com/privacy')}>
            Privacy policy
          </Text>
          .
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSignup} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialButton, styles.googleButton]}
          onPress={handleGoogleSignUp}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.socialButtonText}>Sign up with Google</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.socialButton, styles.outlineButton]} disabled>
          <Text style={styles.socialButtonTextOutline}>Sign up with Facebook</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.socialButton, styles.outlineButton]} disabled>
          <Text style={styles.socialButtonTextOutline}>Sign up with Phone</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.footerLinkText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: spacing.xl, paddingTop: spacing.md },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backArrow: { fontSize: 24, color: colors.gray700 },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: spacing.xl,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    padding: 14,
    borderRadius: 10,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  inputError: { borderColor: '#dc2626' },
  errorText: { color: '#dc2626', fontSize: 13, marginTop: -spacing.sm, marginBottom: spacing.sm },
  phoneRow: { flexDirection: 'row', marginBottom: spacing.md, gap: 8 },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
    paddingHorizontal: 12,
    borderRadius: 10,
    minWidth: 70,
  },
  countryCodeText: { fontSize: 16, color: colors.gray900 },
  dropdown: { fontSize: 10, color: colors.gray500, marginLeft: 4 },
  phoneInput: { flex: 1 },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  pickerItemName: { fontSize: 16, color: colors.gray900 },
  pickerItemCode: { fontSize: 15, color: colors.gray600 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing.md },
  searchInput: { borderWidth: 1, borderColor: colors.gray300, padding: 12, borderRadius: 10, marginBottom: spacing.md, fontSize: 16 },
  countryList: { maxHeight: 320 },
  emptyText: { padding: spacing.lg, textAlign: 'center', color: colors.gray500 },
  modalClose: { marginTop: spacing.md, padding: 14, alignItems: 'center' },
  modalCloseText: { color: colors.primary, fontSize: 16, fontWeight: '500' },
  terms: { fontSize: 13, color: colors.gray500, marginBottom: spacing.lg, lineHeight: 20 },
  link: { color: colors.primary },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  socialButton: { padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: spacing.sm },
  googleButton: { backgroundColor: '#4285f4' },
  outlineButton: { borderWidth: 1, borderColor: colors.gray300 },
  socialButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  socialButtonTextOutline: { color: colors.gray700, fontSize: 16, fontWeight: '500' },
  footerLink: { marginTop: spacing.xl, alignItems: 'center' },
  footerLinkText: { color: colors.primary, fontSize: 15 },
});

export default SignupScreen;
