import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert, Linking, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { pushAppNotification } from '../utils/notifications';
import { openPhoneDialer } from '../utils/phoneDialer';
import { useRideWidget } from '../context/RideWidgetContext';
import { useFocusEffect } from '@react-navigation/native';

const WAIT_MS = 5 * 60 * 1000;

function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const ChatScreen = ({ navigation, route }) => {
  const booking = route?.params?.booking ?? null;
  const rideOption = route?.params?.rideOption ?? null;
  const pickup = route?.params?.pickup ?? '';
  const destination = route?.params?.destination ?? '';
  const selectedPaymentMethod = route?.params?.selectedPaymentMethod || 'cash';
  const selectedPaymentMethodId = route?.params?.selectedPaymentMethodId || null;

  const driver = booking?.driver ?? rideOption?.driver ?? null;
  const driverPhone = driver?.phone || rideOption?.rider?.phone || '';
  const driverName = driver?.name || rideOption?.rider?.name || 'Driver';
  const numberPlate = driver?.numberPlate || rideOption?.rider?.numberPlate || '';
  const provider = rideOption?.provider || '';
  const fare = typeof rideOption?.fare === 'number' ? rideOption.fare : null;
  const { startRideWidget } = useRideWidget();

  const [arrived, setArrived] = useState(false);
  const startRef = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const islandAnim = useRef(new Animated.Value(0)).current;

  const remainingMs = useMemo(() => {
    const elapsed = now - startRef.current;
    return WAIT_MS - elapsed;
  }, [now]);
  const expired = remainingMs <= 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    startRideWidget({
      id: rideOption?.id || booking?.rideId || `ride_${Date.now()}`,
      rideId: rideOption?.id || booking?.rideId || null,
      provider,
      driverName,
      driverPhone,
      numberPlate,
      pickup,
      destination,
      fare,
      paymentMethod: selectedPaymentMethod,
      paymentMethodId: selectedPaymentMethodId,
      paymentMethodLabel: selectedPaymentMethod === 'card' ? 'Card' : selectedPaymentMethod === 'wallet' ? 'Wallet' : 'Cash',
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }, [booking?.rideId, destination, driverName, driverPhone, fare, numberPlate, pickup, provider, rideOption?.id, selectedPaymentMethod, selectedPaymentMethodId, startRideWidget]);

  useEffect(() => {
    islandAnim.setValue(0);
    const sequence = Animated.sequence([
      Animated.delay(2200),
      Animated.timing(islandAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    sequence.start(({ finished }) => {
      if (!finished) return;
      setArrived(true);
      pushAppNotification({
        type: 'driver',
        title: 'Driver arrived',
        body: `${driverName} has arrived at pickup and is waiting for you.`,
        meta: { driverName, provider },
      });
    });

    return () => sequence.stop();
  }, [driverName, islandAnim, provider]);

  const handleCall = async () => {
    if (!driverPhone) return Alert.alert('No phone number', 'Driver phone number is missing.');
    const result = await openPhoneDialer(driverPhone);
    if (!result.ok) {
      return Alert.alert('Cannot call', 'Unable to open the Phone app with this number.');
    }
    pushAppNotification({
      type: 'driver',
      title: 'Call started',
      body: `Calling ${driverName}.`,
      meta: { driverPhone },
    });
  };

  const handleWhatsApp = async () => {
    if (!driverPhone) return Alert.alert('No WhatsApp number', 'Rider WhatsApp number is missing.');
    const digits = String(driverPhone).replace(/\D/g, '');
    const url = `https://wa.me/${digits}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) return Alert.alert('Cannot open WhatsApp', 'WhatsApp is not installed or link is invalid.');
      await Linking.openURL(url);
      pushAppNotification({
        type: 'driver',
        title: 'WhatsApp opened',
        body: `Opened WhatsApp chat with rider ${driverName}.`,
        meta: { driverPhone },
      });
    } catch (_) {
      Alert.alert('Cannot open WhatsApp', 'Failed to open WhatsApp link.');
    }
  };

  const handlePay = () => {
    navigation.navigate('Payment', {
      receipt: {
        provider,
        pickup,
        destination,
        fare,
        driverName,
        driverPhone,
        numberPlate,
        rideId: rideOption?.id || booking?.rideId || null,
        paymentMethod: selectedPaymentMethod,
        paymentMethodId: selectedPaymentMethodId,
      },
      rideId: rideOption?.id || booking?.rideId || null,
      selectedPaymentMethod,
      selectedPaymentMethodId,
    });
  };

  const goToRideScreen = useCallback(() => {
    navigation.navigate('Main', { screen: 'Rides' });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        goToRideScreen();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [goToRideScreen])
  );

  const islandWidth = islandAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 170] });
  const islandHeight = islandAnim.interpolate({ inputRange: [0, 1], outputRange: [56, 36] });
  const bigLabelOpacity = islandAnim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 0, 0] });
  const timerOpacity = islandAnim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0.15, 1] });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goToRideScreen} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{driverName}</Text>
            <Text style={styles.headerSub}>
              {driverPhone || '—'}
              {numberPlate ? ` • ${numberPlate}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={handlePay} style={styles.payPill}>
            <Text style={styles.payPillText}>Pay</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mainBody}>
          <Animated.View style={[styles.island, { width: islandWidth, height: islandHeight }]}>
            <Animated.Text style={[styles.islandBigText, { opacity: bigLabelOpacity }]}>
              Driver is on the way
            </Animated.Text>
            <Animated.Text style={[styles.islandTimer, { opacity: timerOpacity }]}>
              {expired ? '00:00' : formatTime(remainingMs)}
            </Animated.Text>
          </Animated.View>

          <View style={styles.contactCard}>
            <Text style={styles.sectionTitle}>Rider contact</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>WhatsApp</Text>
              <Text style={styles.infoValue}>{driverPhone || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{arrived ? 'Arrived' : 'On the way'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Car No</Text>
              <Text style={styles.infoValue}>{numberPlate || '—'}</Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.whatsAppBtn} onPress={handleWhatsApp}>
                <FontAwesome6 name="whatsapp" size={14} color="#fff" />
                <Text style={styles.whatsAppBtnText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <FontAwesome6 name="phone" size={12} color="#fff" solid />
                <Text style={styles.callBtnText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#f1f5f9' },
  headerBtnText: { fontWeight: '800', color: '#0f172a', fontSize: 12 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontWeight: '900', fontSize: 15, color: '#0f172a' },
  headerSub: { marginTop: 2, fontSize: 12, color: '#64748b', fontWeight: '600' },
  payPill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#2563eb' },
  payPillText: { color: '#fff', fontWeight: '900', fontSize: 12 },

  mainBody: { flex: 1, paddingHorizontal: 14, paddingTop: 12, alignItems: 'center' },
  island: {
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  islandBigText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  islandTimer: { color: '#86efac', fontWeight: '900', fontSize: 13, position: 'absolute' },

  contactCard: {
    marginTop: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#fff',
  },
  sectionTitle: { fontWeight: '900', fontSize: 15, color: '#0f172a', marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 10 },
  infoLabel: { color: '#64748b', fontWeight: '800' },
  infoValue: { color: '#0f172a', fontWeight: '800', flex: 1, textAlign: 'right' },
  actionsRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  whatsAppBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  whatsAppBtnText: { color: '#fff', fontWeight: '900' },
  callBtn: {
    width: 110,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  callBtnText: { color: '#fff', fontWeight: '900' },
});

