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

const ProfileScreen = () => {
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
      Alert.alert('Saved', 'Profile updated.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
