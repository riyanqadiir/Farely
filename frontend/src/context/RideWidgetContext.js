import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'ride_widget_active_v1';

const RideWidgetContext = createContext(null);

/**
 * Widget storage is scoped to authenticated sessions via `authUser` / `authLoading`
 * supplied by AuthProvider (wrapper in App.js). Do not use AuthContext here:
 * Keeps hooks order identical to Fast Refresh caches and avoids "change in order of Hooks".
 */
export const RideWidgetProvider = ({ children, authUser = null, authLoading = true }) => {
  const [activeRide, setActiveRide] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (authLoading) return undefined;
    let mounted = true;

    (async () => {
      try {
        if (!authUser) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          if (!mounted) return;
          setActiveRide(null);
          setHydrated(true);
          return;
        }
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        setActiveRide(raw ? JSON.parse(raw) : null);
      } catch (_) {
        if (mounted) setActiveRide(null);
      } finally {
        if (mounted) setHydrated(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authLoading, authUser]);

  const persist = useCallback(async (ride) => {
    try {
      if (!ride) {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ride));
      }
    } catch (_) {}
  }, []);

  const startRideWidget = useCallback(
    (payload) => {
      const expiresAt = payload?.expiresAt || Date.now() + 5 * 60 * 1000;
      const next = {
        id: payload?.id || `ride_${Date.now()}`,
        rideId: payload?.rideId || null,
        provider: payload?.provider || '',
        driverName: payload?.driverName || 'Driver',
        driverPhone: payload?.driverPhone || '',
        numberPlate: payload?.numberPlate || '',
        pickup: payload?.pickup || '',
        destination: payload?.destination || '',
        fare: payload?.fare ?? null,
        expiresAt,
        startedAt: Date.now(),
      };
      setActiveRide(next);
      persist(next);
    },
    [persist]
  );

  const clearRideWidget = useCallback(() => {
    setActiveRide(null);
    persist(null);
  }, [persist]);

  const value = useMemo(
    () => ({
      activeRide,
      hydrated,
      startRideWidget,
      clearRideWidget,
    }),
    [activeRide, hydrated, startRideWidget, clearRideWidget]
  );

  return <RideWidgetContext.Provider value={value}>{children}</RideWidgetContext.Provider>;
};

export const useRideWidget = () => {
  const ctx = useContext(RideWidgetContext);
  if (!ctx) throw new Error('useRideWidget must be used within RideWidgetProvider');
  return ctx;
};

