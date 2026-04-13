import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import farelyApi from '../api/farelyApi';
import { pushAppNotification } from '../utils/notifications';
import { useRideWidget } from '../context/RideWidgetContext';
import { fetchPaymentMethods } from '../api/paymentMethods';

const PaymentScreen = ({ navigation, route }) => {
  const receipt = route?.params?.receipt ?? {};
  const rideId = route?.params?.rideId || receipt.rideId || null;
  const [method, setMethod] = useState(route?.params?.selectedPaymentMethod || receipt.paymentMethod || 'cash');
  const [paymentMethodId, setPaymentMethodId] = useState(route?.params?.selectedPaymentMethodId || receipt.paymentMethodId || null);
  const [cards, setCards] = useState([]);
  const [paying, setPaying] = useState(false);
  const [completedTx, setCompletedTx] = useState(null);
  const transactionIdRef = useRef(null);
  const { clearRideWidget } = useRideWidget();

  useEffect(() => {
    // stable idempotency key for this payment screen instance
    if (!transactionIdRef.current) {
      transactionIdRef.current = `pay_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const methods = await fetchPaymentMethods();
        if (!mounted) return;
        setCards(methods);
        if (method === 'card' && !paymentMethodId) {
          const defaultCard = methods.find((m) => m.isDefault) || methods[0] || null;
          setPaymentMethodId(defaultCard?.id || null);
        }
      } catch (_) {}
    })();
    return () => {
      mounted = false;
    };
  }, [method, paymentMethodId]);

  const rows = useMemo(
    () => [
      { k: 'Provider', v: receipt.provider || '—' },
      { k: 'Pickup', v: receipt.pickup || '—' },
      { k: 'Destination', v: receipt.destination || '—' },
      { k: 'Driver', v: receipt.driverName || '—' },
      { k: 'Phone', v: receipt.driverPhone || '—' },
      { k: 'Car No', v: receipt.numberPlate || '—' },
      { k: 'Fare', v: typeof receipt.fare === 'number' ? `PKR ${Math.round(receipt.fare)}` : '—' },
    ],
    [receipt]
  );

  const confirmPay = async () => {
    if (paying) return;
    const amount = typeof receipt.fare === 'number' ? receipt.fare : null;
    if (!rideId) return Alert.alert('Missing ride id', 'Cannot store payment without ride id.');
    if (!amount) return Alert.alert('Missing fare', 'Cannot store payment without fare amount.');
    if (method === 'card' && !paymentMethodId) {
      return Alert.alert('Card missing', 'No card selected for card payment.');
    }

    setPaying(true);
    try {
      const payload = {
        transactionId: transactionIdRef.current,
        rideId,
        method,
        amount,
        paymentMethodId: method === 'card' ? paymentMethodId : null,
        meta: {
          provider: receipt.provider || '',
          pickup: receipt.pickup || '',
          destination: receipt.destination || '',
          driverName: receipt.driverName || '',
          driverPhone: receipt.driverPhone || '',
          numberPlate: receipt.numberPlate || '',
        },
      };

      const res = await farelyApi.post('/wallet/pay', payload);
      const duplicated = !!res.data?.duplicated;
      setCompletedTx(res.data?.transaction || null);
      clearRideWidget();
      pushAppNotification({
        type: 'transaction',
        title: duplicated ? 'Payment already recorded' : 'Payment successful',
        body: `${duplicated ? 'Existing' : 'New'} ${method.toUpperCase()} transaction for PKR ${Math.round(amount)}.`,
        meta: { method, amount, rideId },
      });
      Alert.alert('Payment successful', duplicated ? 'Payment already recorded.' : `Paid via ${method.toUpperCase()}.`, [
        { text: 'Done', onPress: () => navigation.popToTop() },
      ]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Payment failed';
      pushAppNotification({
        type: 'transaction',
        title: 'Payment failed',
        body: msg,
        meta: { method, rideId },
      });
      Alert.alert('Payment failed', msg);
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Payment</Text>
          <View style={{ width: 62 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Receipt</Text>
            {rows.map((r) => (
              <View key={r.k} style={styles.row}>
                <Text style={styles.rowKey}>{r.k}</Text>
                <Text style={styles.rowVal} numberOfLines={2}>
                  {r.v}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment method</Text>
            {[
              { id: 'cash', label: 'Cash' },
              { id: 'card', label: 'Card' },
              { id: 'wallet', label: 'Wallet' },
            ].map((m) => (
              <TouchableOpacity key={m.id} style={styles.methodRow} onPress={() => setMethod(m.id)}>
                <View style={[styles.radio, method === m.id ? styles.radioOn : null]} />
                <Text style={styles.methodText}>{m.label}</Text>
              </TouchableOpacity>
            ))}
            {method === 'cash' && (
              <Text style={styles.cashHint}>Pay driver in cash: PKR {Math.round(receipt.fare || 0)}</Text>
            )}
            {method === 'card' && (
              <View style={{ marginTop: 8, gap: 8 }}>
                {cards.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.savedCardRow, paymentMethodId === c.id ? styles.savedCardRowOn : null]}
                    onPress={() => setPaymentMethodId(c.id)}
                  >
                    <Text style={styles.savedCardText}>
                      {c.brand?.toUpperCase()} •••• {c.last4}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {!!completedTx && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment receipt</Text>
              <View style={styles.row}>
                <Text style={styles.rowKey}>Transaction</Text>
                <Text style={styles.rowVal}>{completedTx.transactionId}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowKey}>Method</Text>
                <Text style={styles.rowVal}>{completedTx.method?.toUpperCase()}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowKey}>Status</Text>
                <Text style={styles.rowVal}>{completedTx.meta?.status || 'succeeded'}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.payBtn, paying ? styles.payBtnDisabled : null]} onPress={confirmPay} disabled={paying}>
            {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Pay now</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default PaymentScreen;

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
    justifyContent: 'space-between',
  },
  headerBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#f1f5f9', width: 62 },
  headerBtnText: { fontWeight: '800', color: '#0f172a', fontSize: 12, textAlign: 'center' },
  title: { fontWeight: '900', fontSize: 16, color: '#0f172a' },
  content: { padding: 14, gap: 12, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 14, backgroundColor: '#fff' },
  cardTitle: { fontWeight: '900', fontSize: 14, color: '#0f172a', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  rowKey: { color: '#64748b', fontWeight: '800', fontSize: 12, width: 92 },
  rowVal: { color: '#0f172a', fontWeight: '800', fontSize: 12, flex: 1, textAlign: 'right' },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  methodText: { color: '#0f172a', fontWeight: '800' },
  radio: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, borderColor: '#cbd5e1' },
  radioOn: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  cashHint: { marginTop: 6, color: '#b45309', fontSize: 12, fontWeight: '700' },
  savedCardRow: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10 },
  savedCardRowOn: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  savedCardText: { color: '#0f172a', fontWeight: '800', fontSize: 12 },
  payBtn: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: { color: '#fff', fontWeight: '900' },
});

