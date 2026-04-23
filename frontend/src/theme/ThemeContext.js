import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from './themeTokens';

const STORAGE_KEY = 'farely_theme_mode_v1';

/** @typedef {'system' | 'light' | 'dark'} ThemeMode */

const ThemeContext = createContext(null);

function resolveScheme(mode, systemScheme) {
  if (mode === 'light' || mode === 'dark') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!alive) return;
        if (raw === 'light' || raw === 'dark' || raw === 'system') {
          setModeState(raw);
        }
      } catch (_) {
        // ignore
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setMode = useCallback(async (next) => {
    const v = next === 'light' || next === 'dark' || next === 'system' ? next : 'system';
    setModeState(v);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, v);
    } catch (_) {
      // ignore
    }
  }, []);

  const scheme = resolveScheme(mode, systemScheme || 'light');
  const isDark = scheme === 'dark';

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  const value = useMemo(
    () => ({
      mode,
      scheme,
      isDark,
      colors,
      hydrated,
      setMode,
    }),
    [mode, scheme, isDark, colors, hydrated, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: 'system',
      scheme: 'light',
      isDark: false,
      colors: lightColors,
      hydrated: true,
      setMode: async () => {},
    };
  }
  return ctx;
}
