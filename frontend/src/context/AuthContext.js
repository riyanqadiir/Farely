import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authApi } from '../api/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingProfileComplete, setPendingProfileCompleteState] = useState(false);

  useEffect(() => {
    const webClientId = Constants.expoConfig?.extra?.googleWebClientId;
    const iosClientId = Constants.expoConfig?.extra?.googleIosClientId;
    if (webClientId || iosClientId) {
      GoogleSignin.configure({
        webClientId: webClientId || undefined,
        iosClientId: iosClientId || undefined,
      });
    }
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const res = await authApi.getMe();
        setUser(res.data?.user ?? res.data);
        const pending = await AsyncStorage.getItem('pendingProfileComplete');
        setPendingProfileCompleteState(pending === 'true');
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

  const setPendingProfileComplete = (value) => {
    setPendingProfileCompleteState(!!value);
    if (value) AsyncStorage.setItem('pendingProfileComplete', 'true');
    else AsyncStorage.removeItem('pendingProfileComplete');
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
      const msg = err.response?.data?.message || err.message || 'Google Sign-In failed.';
      return { success: false, msg };
    }
  };

  const logout = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (_) {}
    await AsyncStorage.removeItem('token');
    setUser(null);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
