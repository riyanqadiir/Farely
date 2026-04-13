import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useFocusEffect } from '@react-navigation/native';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { runAfterNavigationTransition } from '../utils/navigationTiming';
import { fetchPaymentMethods, createPaymentMethod } from '../api/paymentMethods';
import Constants from 'expo-constants';

const PaymentMethodsScreen = ({ navigation }) => {
  const { createPaymentMethod: createStripePaymentMethod } = useStripe();
  const stripePublishableKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    Constants?.expoConfig?.extra?.stripePublishableKey ||
    '';
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (opts = { showSpinner: true }) => {
    if (opts.showSpinner) setLoading(true);
    try {
      const list = await fetchPaymentMethods();
      setCards(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const cancelTransition = runAfterNavigationTransition(() => {
        if (cancelled) return;
        const showSpinner = !hasLoadedRef.current;
        hasLoadedRef.current = true;
        load({ showSpinner });
      });
      return () => {
        cancelled = true;
        cancelTransition?.();
      };
    }, [load])
  );

  const openAdd = () => {
    setLabel('');
    setCardComplete(false);
    setModalOpen(true);
  };

  const saveCard = async () => {
    if (!label.trim()) return Alert.alert('Missing label', 'Enter a name for this card.');
    if (!cardComplete) return Alert.alert('Card incomplete', 'Please enter complete card details.');
    if (!stripePublishableKey) {
      return Alert.alert(
        'Stripe not configured',
        'Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY. Restart Metro after updating frontend/.env.'
      );
    }

    setSaving(true);
    try {
      const { paymentMethod, error } = await createStripePaymentMethod({
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: {
            name: label.trim(),
          },
        },
      });

      if (error) {
        Alert.alert('Stripe error', error.message || 'Could not create card.');
        return;
      }
      if (!paymentMethod?.id) {
        Alert.alert('Card error', 'No payment method was returned by Stripe.');
        return;
      }

      await createPaymentMethod({
        label: label.trim(),
        stripePaymentMethodId: paymentMethod.id,
      });
      setModalOpen(false);
      await load({ showSpinner: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Payment methods</Text>
        <Text style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Add real test cards here using Stripe CardField. Cards are tokenized and only safe metadata is stored in the
          backend.
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color="#2563eb" />
        ) : (
          cards.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.cardRow}
              onPress={() => navigation.navigate('CardSettings', { cardId: c.id })}
              activeOpacity={0.85}
            >
              <View style={styles.cardIcon}>
                <FontAwesome6
                  name={c.brand === 'mastercard' ? 'cc-mastercard' : 'cc-visa'}
                  size={22}
                  color="#0f172a"
                />
              </View>
              <View style={styles.cardMid}>
                <Text style={styles.cardLabel}>{c.label || 'Card'}</Text>
                <Text style={styles.cardMeta}>
                  •••• {c.last4} · {c.expMonth}/{c.expYear}
                </Text>
                {c.isDefault && (
                  <View style={styles.defaultPill}>
                    <Text style={styles.defaultPillText}>Default</Text>
                  </View>
                )}
              </View>
              <FontAwesome6 name="chevron-right" size={12} color="#94a3b8" solid />
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <FontAwesome6 name="plus" size={14} color="#fff" solid />
          <Text style={styles.addBtnText}>Add payment method</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add card</Text>
            <Text style={styles.modalHint}>Enter card details (test mode supported).</Text>

            <Text style={styles.fieldLabel}>Label</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Work Visa"
              value={label}
              onChangeText={setLabel}
            />

            <Text style={styles.fieldLabel}>Card details</Text>
            <CardField
              postalCodeEnabled={false}
              placeholders={{ number: '4242 4242 4242 4242' }}
              cardStyle={{
                backgroundColor: '#ffffff',
                textColor: '#0f172a',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                borderRadius: 10,
              }}
              style={styles.cardField}
              onCardChange={(details) => setCardComplete(!!details?.complete)}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveCard} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PaymentMethodsScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 88 },
  backText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  title: { fontSize: 17, fontWeight: '900', color: '#0f172a', flex: 1, textAlign: 'center' },
  headerRight: { width: 88 },
  scroll: { padding: 16, paddingBottom: 40 },
  intro: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardIcon: { width: 40, alignItems: 'center' },
  cardMid: { flex: 1 },
  cardLabel: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  cardMeta: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 2 },
  defaultPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  defaultPillText: { fontSize: 10, fontWeight: '800', color: '#047857' },
  addBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 28,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  modalHint: { fontSize: 12, color: '#64748b', marginTop: 6, marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardField: {
    width: '100%',
    height: 46,
    marginTop: 6,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalCancelText: { fontWeight: '800', color: '#64748b' },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  modalSaveText: { fontWeight: '800', color: '#fff' },
});
