import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Animated,
  Easing,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  const driver = booking?.driver ?? rideOption?.driver ?? null;
  const driverPhone = driver?.phone || rideOption?.rider?.phone || '';
  const driverName = driver?.name || rideOption?.rider?.name || 'Driver';
  const numberPlate = driver?.numberPlate || rideOption?.rider?.numberPlate || '';
  const provider = rideOption?.provider || '';
  const fare = typeof rideOption?.fare === 'number' ? rideOption.fare : null;

  const [messages, setMessages] = useState(() => [
    {
      id: 'sys-1',
      from: 'system',
      text: 'Driver assigned. You can call or send a quick message.',
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [arrived, setArrived] = useState(false);
  const [arrivePopup, setArrivePopup] = useState(false);

  const startRef = useRef(Date.now());
  const [now, setNow] = useState(Date.now());

  const { width } = Dimensions.get('window');
  const trackWidth = Math.min(320, width - 64);
  const carX = useRef(new Animated.Value(0)).current;

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
    // Driver slide animation
    carX.setValue(0);
    const anim = Animated.timing(carX, {
      toValue: 1,
      duration: 2200,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!finished) return;
      setArrived(true);
      setArrivePopup(true);
      setMessages((prev) => [
        ...prev,
        { id: `sys-arr-${Date.now()}`, from: 'system', text: "Driver has arrived.", ts: Date.now() },
      ]);
      setTimeout(() => setArrivePopup(false), 1600);
    });
    return () => {
      anim.stop();
    };
  }, [carX]);

  const handleCall = async () => {
    if (!driverPhone) return Alert.alert('No phone number', 'Driver phone number is missing.');
    const url = `tel:${driverPhone}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) return Alert.alert('Cannot call', 'Calling is not available on this device.');
      await Linking.openURL(url);
    } catch (_) {
      Alert.alert('Cannot call', 'Calling failed.');
    }
  };

  const sendMessage = (text, from = 'me') => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: `${from}-${Date.now()}`, from, text: trimmed, ts: Date.now() },
    ]);
  };

  const handleSend = () => {
    if (expired) return;
    sendMessage(input, 'me');
    setInput('');
  };

  const handleImComing = () => {
    if (expired) return;
    sendMessage("I'm coming.", 'me');
    sendMessage('Okay, I will wait at pickup.', 'driver');
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
      },
      rideId: rideOption?.id || booking?.rideId || null,
    });
  };

  const carTranslate = carX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, trackWidth - 42],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{driverName}</Text>
            <Text style={styles.headerSub}>
              {driverPhone || '—'}{numberPlate ? ` • ${numberPlate}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={handlePay} style={styles.payPill}>
            <Text style={styles.payPillText}>Pay</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>{arrived ? 'Arrived' : 'On the way'}</Text>
            <Text style={[styles.timer, expired ? styles.timerExpired : null]}>
              {expired ? 'Waiting time ended' : `Waiting: ${formatTime(remainingMs)}`}
            </Text>
          </View>

          <View style={styles.trackWrap}>
            <View style={[styles.track, { width: trackWidth }]}>
              <View style={styles.dotLeft} />
              <View style={styles.dotRight} />
              <Animated.View style={[styles.car, { transform: [{ translateX: carTranslate }] }]}>
                <Text style={styles.carText}>🚗</Text>
              </Animated.View>
            </View>
            {!!arrivePopup && (
              <View style={styles.popup}>
                <Text style={styles.popupText}>Driver arrived</Text>
              </View>
            )}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, expired ? styles.actionDisabled : null]} onPress={handleImComing} disabled={expired}>
              <Text style={styles.actionBtnText}>I’m coming</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatContent}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.from === 'me' ? styles.bubbleMe : null,
                item.from === 'driver' ? styles.bubbleDriver : null,
                item.from === 'system' ? styles.bubbleSystem : null,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.from === 'me' ? styles.bubbleTextMe : null,
                  item.from === 'system' ? styles.bubbleTextSystem : null,
                ]}
              >
                {item.text}
              </Text>
            </View>
          )}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={[styles.input, expired ? styles.inputDisabled : null]}
            placeholder={expired ? 'Waiting ended' : 'Message...'}
            placeholderTextColor="#94a3b8"
            value={input}
            onChangeText={setInput}
            editable={!expired}
          />
          <TouchableOpacity style={[styles.sendBtn, expired ? styles.sendDisabled : null]} onPress={handleSend} disabled={expired}>
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
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

  statusCard: {
    margin: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#fff',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { fontWeight: '900', color: '#0f172a' },
  timer: { fontWeight: '900', color: '#16a34a' },
  timerExpired: { color: '#dc2626' },

  trackWrap: { marginTop: 12, alignItems: 'center' },
  track: {
    height: 28,
    borderRadius: 999,
    backgroundColor: '#d9f99d',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dotLeft: {
    position: 'absolute',
    left: 10,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#60a5fa',
    backgroundColor: '#fff',
  },
  dotRight: {
    position: 'absolute',
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#84cc16',
    backgroundColor: '#fff',
  },
  car: { position: 'absolute', left: 10 },
  carText: { fontSize: 18 },
  popup: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  popupText: { color: '#fff', fontWeight: '900', fontSize: 12 },

  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionDisabled: { opacity: 0.5 },
  actionBtnText: { color: '#fff', fontWeight: '900' },
  callBtn: {
    width: 96,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  callBtnText: { color: '#fff', fontWeight: '900' },

  chatContent: { paddingHorizontal: 14, paddingBottom: 10, gap: 10 },
  bubble: { maxWidth: '80%', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#2563eb' },
  bubbleDriver: { alignSelf: 'flex-start', backgroundColor: '#f1f5f9' },
  bubbleSystem: { alignSelf: 'center', backgroundColor: '#fef3c7' },
  bubbleText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  bubbleTextMe: { color: '#fff' },
  bubbleTextSystem: { color: '#92400e' },

  inputBar: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
    color: '#0f172a',
  },
  inputDisabled: { backgroundColor: '#f8fafc', color: '#94a3b8' },
  sendBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  sendDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#fff', fontWeight: '900' },
});

