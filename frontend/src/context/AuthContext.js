import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { authApi } from '../api/auth';

export const AuthContext = createContext();
let googleSigninModule = null;

/** @deprecated Legacy single-key flag; prefer per-user keys. */
const LEGACY_PROFILE_ONBOARDED_KEY = 'profileOnboarded';

function userIdFromUser(u) {
  if (!u) return null;
  const id = u.id ?? u._id;
  return id != null ? String(id) : null;
}

function profileOnboardedKeyForUser(userId) {
  return userId ? `profileOnboarded:${userId}` : LEGACY_PROFILE_ONBOARDED_KEY;
}

/** Whether this account has finished the one-time profile step (device-local). */
async function readProfileOnboardedFlag(user) {
  const uid = userIdFromUser(user);
  if (!uid) return false;
  const keyed = await AsyncStorage.getItem(profileOnboardedKeyForUser(uid));
  if (keyed === 'true') return true;
  const legacy = await AsyncStorage.getItem(LEGACY_PROFILE_ONBOARDED_KEY);
  if (legacy === 'true') {
    await AsyncStorage.setItem(profileOnboardedKeyForUser(uid), 'true');
    await AsyncStorage.removeItem(LEGACY_PROFILE_ONBOARDED_KEY);
    return true;
  }
  return false;
}

function isExpoGoRuntime() {
  return Constants.executionEnvironment === 'storeClient';
}

async function getGoogleSignin() {
  if (isExpoGoRuntime()) return null;
  if (googleSigninModule) return googleSigninModule;
  try {
    const mod = await import('@react-native-google-signin/google-signin');
    googleSigninModule = mod.GoogleSignin;
    return googleSigninModule;
  } catch (_) {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingProfileComplete, setPendingProfileCompleteState] = useState(false);

  useEffect(() => {
    const configureGoogle = async () => {
      const GoogleSignin = await getGoogleSignin();
      if (!GoogleSignin) return;
      const webClientId = Constants.expoConfig?.extra?.googleWebClientId;
      const iosClientId = Constants.expoConfig?.extra?.googleIosClientId;
      if (webClientId || iosClientId) {
        GoogleSignin.configure({
          webClientId: webClientId || undefined,
          iosClientId: iosClientId || undefined,
        });
      }
    };
    configureGoogle();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const res = await authApi.getMe();
        const u = res.data?.user ?? res.data;
        setUser(u);
        const onboarded = await readProfileOnboardedFlag(u);
        setPendingProfileCompleteState(!onboarded);
      } else {
        setUser(null);
        setPendingProfileCompleteState(false);
      }
    } catch (err) {
      setUser(null);
      setPendingProfileCompleteState(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mark the one-time profile step complete for this account (device-local).
   * Pass `userId` string after signup save so we do not rely on a stale `user` ref.
   */
  const markProfileOnboardingDone = async (userOrId) => {
    let uid = null;
    if (typeof userOrId === 'string' && userOrId) uid = userOrId;
    else if (userOrId && typeof userOrId === 'object') uid = userIdFromUser(userOrId);
    else uid = userIdFromUser(user);
    if (uid) {
      await AsyncStorage.setItem(profileOnboardedKeyForUser(uid), 'true');
      await AsyncStorage.removeItem(LEGACY_PROFILE_ONBOARDED_KEY);
    }
    setPendingProfileCompleteState(false);
  };

  const setPendingProfileComplete = (value) => {
    setPendingProfileCompleteState(!!value);
  };

  const login = async (loginId, password) => {
    try {
      const res = await authApi.login({ loginId, password });
      await AsyncStorage.setItem('token', res.data.token);
      await loadUser();
      return { success: true };
    } catch (err) {
      return { success: false, msg: err.response?.data?.message || 'Login failed' };
    }
  };

  /** Multi-step signup: use authApi.signup, authApi.verifyOtp, authApi.setPassword separately.
   *  This stub is for backward compatibility until SignupScreen is updated. */
  const signup = async () => {
    return { success: false, msg: 'Use new signup flow (OTP → Set Password)' };
  };

  const googleSignIn = async () => {
    try {
      const GoogleSignin = await getGoogleSignin();
      if (!GoogleSignin) {
        return { success: false, msg: 'Google Sign-In is unavailable in Expo Go. Use a development build.' };
      }
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      if (signInResult?.type !== 'success' || !signInResult.data?.idToken) {
        return { success: false, msg: signInResult?.type === 'cancelled' ? 'Sign-in was cancelled.' : 'Could not get ID token.' };
      }
      const res = await authApi.google({ idToken: signInResult.data.idToken });
      await AsyncStorage.setItem('token', res.data.token);
      await loadUser();
      return { success: true };
    } catch (err) {
      const raw = err.response?.data?.message || err.message || 'Google Sign-In failed.';
      const combined = `${raw} ${err?.code ?? ''}`;
      if (/DEVELOPER_ERROR|developer_error|code.*10/i.test(combined)) {
        return {
          success: false,
          msg:
            'Google Sign-In is not configured for this Android build. In Google Cloud Console, add an OAuth '
            + '"Android" client with package com.farely.app and your debug keystore SHA-1, then rebuild the app. '
            + 'See docs/GOOGLE_SSO_SETUP.md',
        };
      }
      return { success: false, msg: raw };
    }
  };

  const logout = async () => {
    try {
      const GoogleSignin = await getGoogleSignin();
      if (GoogleSignin) await GoogleSignin.signOut();
    } catch (_) {}
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('pendingProfileComplete');
    setUser(null);
    setPendingProfileCompleteState(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        googleSignIn,
        logout,
        loadUser,
        authApi,
        pendingProfileComplete,
        setPendingProfileComplete,
        markProfileOnboardingDone,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
