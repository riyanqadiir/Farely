import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRideWidget } from '../context/RideWidgetContext';
import { pushAppNotification } from '../utils/notifications';

function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const RideWidget = ({ navigationRef }) => {
  const { activeRide, clearRideWidget } = useRideWidget();
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

  const handlePay = () => {
    const nav = navigationRef?.current;
    if (!nav) return;
    pushAppNotification({
      type: 'transaction',
      title: 'Payment opened',
      body: 'Opened payment from ride widget.',
      meta: { rideId: activeRide.rideId || activeRide.id || null },
    });
    nav.navigate('Payment', {
      receipt: {
        provider: activeRide.provider,
        pickup: activeRide.pickup,
        destination: activeRide.destination,
        fare: activeRide.fare,
        driverName: activeRide.driverName,
        driverPhone: activeRide.driverPhone,
        numberPlate: activeRide.numberPlate,
        rideId: activeRide.rideId || activeRide.id,
      },
      rideId: activeRide.rideId || activeRide.id,
    });
  };

  const handleCancel = () => {
    pushAppNotification({
      type: 'ride',
      title: 'Ride cancelled',
      body: `${activeRide.provider || 'Farely'} ride was cancelled from widget.`,
      meta: { rideId: activeRide.rideId || activeRide.id || null },
    });
    clearRideWidget();
    const nav = navigationRef?.current;
    if (nav) nav.navigate('Main', { screen: 'Rides' });
  };

  const handleOpenBookedScreen = () => {
    const nav = navigationRef?.current;
    if (!nav) return;
    nav.navigate('Chat', {
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

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <TouchableOpacity activeOpacity={0.92} style={styles.card} onPress={handleOpenBookedScreen}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Ride in progress</Text>
          <Text style={styles.timer}>{formatTime(remaining)}</Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {activeRide.provider || 'Farely'} • {activeRide.driverName || 'Driver'}
        </Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.payBtn} onPress={handlePay}>
            <Text style={styles.payBtnText}>Pay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancel ride</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
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
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontWeight: '900' },
  timer: { color: '#86efac', fontWeight: '900' },
  subtitle: { marginTop: 6, color: '#cbd5e1', fontWeight: '700', fontSize: 12 },
  actionsRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  payBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  payBtnText: { color: '#fff', fontWeight: '900' },
  cancelBtn: { flex: 1, backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: '900' },
});

