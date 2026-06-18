import React, { useState, useContext, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
  useWindowDimensions,
} from 'react-native';
let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (_) {}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { AuthContext } from '../context/AuthContext';
import { profileApi } from '../api/profile';
import { colors, spacing } from '../constants/theme';
import { pushAppNotification } from '../utils/notifications';
import ReadOnlyProfileField from '../components/ReadOnlyProfileField';
import { useTheme } from '../theme/ThemeContext';

const ProfileScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors: themeColors } = useTheme();
  const horizontalMargin = useMemo(() => {
    if (windowWidth >= 900) return Math.max(24, (windowWidth - 640) / 2);
    if (windowWidth >= 600) return Math.max(20, (windowWidth - 560) / 2);
    return 0;
  }, [windowWidth]);

  const [fullName, setFullName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { user, loadUser } = useContext(AuthContext);

  const profilePhotoUrl = user?.profilePhotoUrl || photoUri;
  const openedFromMenu = !!route?.params?.fromMenu;
  const accountEmail = user?.email || '';
  const accountPhone = user?.phone || user?.loginId || '';

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setStreet(user.street || '');
      setCity(user.city || '');
      setDistrict(user.district || '');
    }
  }, [user]);

  const handlePickPhoto = async () => {
    if (!ImagePicker) {
      Alert.alert(
        'Rebuild required',
        'Profile photo requires a native rebuild. Stop the app, run: npx expo prebuild --clean && npx expo run:android'
      );
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to add a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;
      setUploadingPhoto(true);
      const formData = new FormData();
      const ext = asset.uri.split('.').pop() || 'jpg';
      const type = asset.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg');
      formData.append('photo', {
        uri: asset.uri,
        type,
        name: `photo.${ext}`,
      });
      const { data } = await profileApi.uploadPhoto(formData);
      setPhotoUri(data.profile?.profilePhotoUrl || asset.uri);
      await loadUser();
    } catch (err) {
      if (err?.message?.includes('ExponentImagePicker') || err?.message?.includes('native module')) {
        Alert.alert(
          'Rebuild required',
          'Profile photo requires a native rebuild. Stop the app, run: npx expo prebuild --clean && npx expo run:android'
        );
      } else {
        const msg = err.response?.data?.message
          || (err.message?.toLowerCase().includes('network') || err.message?.toLowerCase().includes('failed')
            ? 'Cannot reach server. Ensure backend is running and API URL in frontend/src/config/api.js is correct.'
            : err.message || 'Could not upload photo.');
        Alert.alert('Upload failed', msg);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) return Alert.alert('Error', 'Please enter your full name.');
    setLoading(true);
    try {
      await profileApi.updateProfile({
        fullName: fullName.trim(),
        street: street.trim() || undefined,
        city: city.trim() || undefined,
        district: district.trim() || undefined,
      });
      await loadUser();
      pushAppNotification({
        type: 'app',
        title: 'Profile updated',
        body: 'Your profile settings were saved successfully.',
        meta: {},
      });
      Alert.alert('Saved', 'Profile updated.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.bg }]}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingHorizontal: spacing.xl + horizontalMargin,
          paddingBottom: spacing.xxl + insets.bottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {!openedFromMenu && (
        <View
          style={[
            styles.tabActionsBar,
            {
              marginHorizontal: -(spacing.xl + horizontalMargin),
              paddingTop: insets.top + 8,
              paddingHorizontal: 14 + horizontalMargin,
              paddingBottom: 12,
              backgroundColor: themeColors.surface,
              borderBottomColor: themeColors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate('Menu')}
            style={[styles.tabActionBtnPrimary, { backgroundColor: themeColors.accent }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Menu"
            accessibilityHint="Opens account menu and settings"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontAwesome6 name="bars" size={18} color={themeColors.onAccent} solid />
          </TouchableOpacity>
          <Text style={[styles.tabActionsTitle, { color: themeColors.text }]}>Profile</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notification')}
            style={[styles.tabActionBtn, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontAwesome6 name="bell" size={18} color={themeColors.textSecondary} regular />
          </TouchableOpacity>
        </View>
      )}
      {openedFromMenu && (
        <View style={[styles.inlineHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Menu'))}
            style={styles.inlineBackBtn}
          >
            <Text style={styles.inlineBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.inlineHeaderTitle}>Profile settings</Text>
          <View style={{ width: 64 }} />
        </View>
      )}
      <Text style={[styles.title, { color: themeColors.text }]}>Edit Profile</Text>

      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={handlePickPhoto}
        disabled={uploadingPhoto}
      >
        {profilePhotoUrl ? (
          <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {uploadingPhoto ? '...' : 'Add Photo'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TextInput
        style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.surfaceElevated }]}
        placeholder="Full Name"
        placeholderTextColor={themeColors.textMuted}
        value={fullName}
        onChangeText={setFullName}
      />
      <ReadOnlyProfileField
        label="Email"
        value={accountEmail}
        themeColors={themeColors}
      />
      {!!accountPhone && (
        <ReadOnlyProfileField
          label="Phone"
          value={accountPhone}
          themeColors={themeColors}
        />
      )}
      <TextInput
        style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.surfaceElevated }]}
        placeholder="Street"
        placeholderTextColor={themeColors.textMuted}
        value={street}
        onChangeText={setStreet}
      />
      <TextInput
        style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.surfaceElevated }]}
        placeholder="City"
        placeholderTextColor={themeColors.textMuted}
        value={city}
        onChangeText={setCity}
      />
      <TextInput
        style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.surfaceElevated }]}
        placeholder="District"
        placeholderTextColor={themeColors.textMuted}
        value={district}
        onChangeText={setDistrict}
      />

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: themeColors.accent }]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={themeColors.onAccent} />
        ) : (
          <Text style={[styles.saveButtonText, { color: themeColors.onAccent }]}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  tabActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    gap: 8,
  },
  tabActionBtnPrimary: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tabActionsTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
  },
  inlineHeader: {
    marginTop: 10,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineBackBtn: {
    width: 64,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  inlineBackText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  inlineHeaderTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  title: { fontSize: 20, fontWeight: '600', color: colors.gray900, marginBottom: spacing.xl },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: { color: colors.gray500, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    padding: 14,
    borderRadius: 10,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonText: { fontSize: 16, fontWeight: '600' },
});

export default ProfileScreen;
