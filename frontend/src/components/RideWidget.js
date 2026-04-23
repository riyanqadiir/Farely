import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRideWidget } from '../context/RideWidgetContext';
import { pushAppNotification } from '../utils/notifications';
import { openPhoneDialer } from '../utils/phoneDialer';
import { useTheme } from '../theme/ThemeContext';

function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const RideWidget = ({ navigationRef }) => {
  const { activeRide, clearRideWidget } = useRideWidget();
  const { colors, isDark } = useTheme();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!activeRide) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeRide]);

  const remaining = useMemo(() => {
    if (!activeRide?.expiresAt) return 0;
    return Math.max(0, activeRide.expiresAt - now);
  }, [activeRide, now]);

  if (!activeRide) return null;

  const handleDone = () => {
    pushAppNotification({
      type: 'ride',
      title: 'Trip card dismissed',
      body: 'Pay and finalize your trip in the provider app.',
      meta: { rideId: activeRide.rideId || activeRide.id || null },
    });
    clearRideWidget();
  };

  const handleCancel = () => {
    pushAppNotification({
      type: 'ride',
      title: 'Ride cancelled',
      body: `${activeRide.provider || 'Farely'} ride was cancelled from widget.`,
      meta: { rideId: activeRide.rideId || activeRide.id || null },
    });
    clearRideWidget();
    if (navigationRef?.isReady()) {
      navigationRef.navigate('Main', { screen: 'Rides' });
    }
  };

  const handleCallDriver = async () => {
    const phone = activeRide.driverPhone;
    if (!phone) {
      Alert.alert('No phone number', 'Driver phone number is not available.');
      return;
    }
    const result = await openPhoneDialer(phone);
    if (!result.ok) {
      Alert.alert('Cannot call', 'Unable to open the Phone app with this number.');
      return;
    }
    pushAppNotification({
      type: 'driver',
      title: 'Call started',
      body: `Calling ${activeRide.driverName || 'driver'}.`,
      meta: { driverPhone: phone },
    });
  };

  const handleOpenBookedScreen = () => {
    if (!navigationRef?.isReady()) return;
    navigationRef.navigate('Chat', {
      booking: {
        driver: {
          name: activeRide.driverName || 'Driver',
          phone: activeRide.driverPhone || '',
          numberPlate: activeRide.numberPlate || '',
        },
        rideId: activeRide.rideId || activeRide.id || null,
      },
      rideOption: {
        id: activeRide.rideId || activeRide.id || null,
        provider: activeRide.provider || 'Farely',
        fare: typeof activeRide.fare === 'number' ? activeRide.fare : null,
        rider: {
          name: activeRide.driverName || 'Driver',
          phone: activeRide.driverPhone || '',
          numberPlate: activeRide.numberPlate || '',
        },
      },
      pickup: activeRide.pickup || '',
      destination: activeRide.destination || '',
    });
  };

  const cardBg = isDark ? '#0f172a' : '#0c1222';
  const cardBorder = isDark ? '#1e293b' : '#1e293b';

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <TouchableOpacity activeOpacity={0.92} onPress={handleOpenBookedScreen}>
          <View style={styles.topRow}>
            <Text style={styles.title}>Ride in progress</Text>
            <Text style={[styles.timer, { color: colors.success }]}>{formatTime(remaining)}</Text>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {activeRide.provider || 'Farely'} • {activeRide.driverName || 'Driver'}
          </Text>
        </TouchableOpacity>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.payBtn, { backgroundColor: colors.accent }]} onPress={handleDone}>
            <Text style={[styles.payBtnText, { color: colors.onAccent }]}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.callBtn, !activeRide.driverPhone && styles.callBtnDisabled]}
            onPress={handleCallDriver}
            disabled={!activeRide.driverPhone}
            accessibilityRole="button"
            accessibilityLabel="Call driver"
          >
            <FontAwesome6 name="phone" size={14} color={colors.onAccent} solid />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancel ride</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default RideWidget;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 86,
    alignItems: 'center',
    zIndex: 100,
    elevation: 12,
  },
  card: {
    width: '92%',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontWeight: '900' },
  timer: { fontWeight: '900' },
  subtitle: { marginTop: 6, color: '#cbd5e1', fontWeight: '700', fontSize: 12 },
  actionsRow: { marginTop: 10, flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  payBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  payBtnText: { fontWeight: '900' },
  callBtn: {
    width: 44,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnDisabled: { opacity: 0.45 },
  cancelBtn: { flex: 1, backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: '900' },
});

