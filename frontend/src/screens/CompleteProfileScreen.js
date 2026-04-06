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
import AsyncStorage from '@react-native-async-storage/async-storage';
let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (_) {}
import { AuthContext } from '../context/AuthContext';
import { profileApi } from '../api/profile';
import { colors, spacing } from '../constants/theme';

const CompleteProfileScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { user, setPendingProfileComplete, loadUser } = useContext(AuthContext);

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
    if (!fullName.trim()) return alert('Please enter your full name.');
    setLoading(true);
    try {
      await profileApi.updateProfile({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        street: street.trim() || undefined,
        city: city.trim() || undefined,
        district: district.trim() || undefined,
      });
      await AsyncStorage.setItem('profileOnboarded', 'true');
      await loadUser?.();
      setPendingProfileComplete?.(false);
      navigation.replace('Main');
    } catch (err) {
      alert(err.response?.data?.message || 'Could not save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await AsyncStorage.setItem('profileOnboarded', 'true');
    setPendingProfileComplete?.(false);
    navigation.replace('Main');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Profile</Text>

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

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backArrow: { fontSize: 24, color: colors.gray700 },
  title: { fontSize: 20, fontWeight: '600', color: colors.gray900, marginBottom: spacing.lg },
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
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  cancelButtonText: { color: colors.gray700, fontSize: 16, fontWeight: '600' },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default CompleteProfileScreen;
