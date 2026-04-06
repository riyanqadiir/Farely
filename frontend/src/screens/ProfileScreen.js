import React, { useState, useContext, useEffect } from 'react';
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
} from 'react-native';
let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (_) {}
import { AuthContext } from '../context/AuthContext';
import { profileApi } from '../api/profile';
import { colors, spacing } from '../constants/theme';
import { pushAppNotification } from '../utils/notifications';

const ProfileScreen = ({ navigation, route }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { user, loadUser } = useContext(AuthContext);

  const profilePhotoUrl = user?.profilePhotoUrl || photoUri;
  const openedFromMenu = !!route?.params?.fromMenu;

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
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
        email: email.trim() || undefined,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {openedFromMenu && (
        <View style={styles.inlineHeader}>
          <TouchableOpacity onPress={() => navigation.navigate('Menu')} style={styles.inlineBackBtn}>
            <Text style={styles.inlineBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.inlineHeaderTitle}>Profile settings</Text>
          <View style={{ width: 64 }} />
        </View>
      )}
      <Text style={styles.title}>Edit Profile</Text>

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
        style={styles.input}
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Street"
        value={street}
        onChangeText={setStreet}
      />
      <TextInput
        style={styles.input}
        placeholder="City"
        value={city}
        onChangeText={setCity}
      />
      <TextInput
        style={styles.input}
        placeholder="District"
        value={district}
        onChangeText={setDistrict}
      />

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: spacing.xl },
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
  inlineBackText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
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
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default ProfileScreen;
