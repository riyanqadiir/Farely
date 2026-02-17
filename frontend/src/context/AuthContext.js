import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import farelyApi from '../api/farelyApi';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const res = await farelyApi.get('/auth');
        setUser(res.data); // This should now include the role
      }
    } catch (err) {
      console.log('User not authenticated');
    } finally {
      setLoading(false);
    }
  };

  const login = async (phone, password) => {
    try {
      const res = await farelyApi.post('/auth', { phone, password });
      await AsyncStorage.setItem('token', res.data.token);
      await loadUser();
      return { success: true };
    } catch (err) {
      return { success: false, msg: err.response?.data?.msg || 'Login failed' };
    }
  };

  const signup = async (name, phone, password) => {
    try {
      const res = await farelyApi.post('/users', { name, phone, password });
      await AsyncStorage.setItem('token', res.data.token);
      await loadUser();
      return { success: true };
    } catch (err) {
      return { success: false, msg: err.response?.data?.msg || 'Signup failed' };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
