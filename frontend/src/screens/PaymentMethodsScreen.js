import React, { useCallback, useState } from 'react';
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
import { getPaymentMethods, addPaymentMethod } from '../utils/paymentMethodsStorage';

const BRANDS = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
];

const PaymentMethodsScreen = ({ navigation }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [brand, setBrand] = useState('visa');
  const [label, setLabel] = useState('');
  const [last4, setLast4] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await getPaymentMethods();
    if (list.length === 0) {
      await addPaymentMethod({
        brand: 'visa',
        last4: '4242',
        expMonth: '12',
        expYear: '28',
        label: 'Personal',
        isDefault: true,
      });
      setCards(await getPaymentMethods());
    } else {
      setCards(list);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openAdd = () => {
    setBrand('visa');
    setLabel('');
    setLast4('');
    setExpMonth('');
    setExpYear('');
    setModalOpen(true);
  };

  const saveCard = async () => {
    const l4 = last4.replace(/\D/g, '').slice(0, 4);
    const m = expMonth.replace(/\D/g, '').slice(0, 2);
    const y = expYear.replace(/\D/g, '').slice(0, 2);
    if (!label.trim()) return Alert.alert('Missing label', 'Enter a name for this card.');
    if (l4.length !== 4) return Alert.alert('Invalid card', 'Enter the last 4 digits.');
    if (!m || Number(m) < 1 || Number(m) > 12) return Alert.alert('Invalid expiry', 'Enter month 01–12.');
    if (!y || y.length !== 2) return Alert.alert('Invalid expiry', 'Enter 2-digit year (e.g. 28).');

    setSaving(true);
    try {
      await addPaymentMethod({
        brand,
        last4: l4,
        expMonth: m.padStart(2, '0'),
        expYear: y,
        label: label.trim(),
        isDefault: cards.length === 0,
      });
      setModalOpen(false);
      await load();
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
          Cards saved here are used for ride payments in the app. For this demo, details are stored only on
          the device (not sent to a payment processor).
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
            <Text style={styles.modalHint}>Demo only — no real card numbers.</Text>

            <Text style={styles.fieldLabel}>Label</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Work Visa"
              value={label}
              onChangeText={setLabel}
            />

            <Text style={styles.fieldLabel}>Brand</Text>
            <View style={styles.brandRow}>
              {BRANDS.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.brandChip, brand === b.id && styles.brandChipOn]}
                  onPress={() => setBrand(b.id)}
                >
                  <Text style={[styles.brandChipText, brand === b.id && styles.brandChipTextOn]}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Last 4 digits</Text>
            <TextInput
              style={styles.input}
              placeholder="4242"
              keyboardType="number-pad"
              maxLength={4}
              value={last4}
              onChangeText={(t) => setLast4(t.replace(/\D/g, '').slice(0, 4))}
            />

            <View style={styles.expRow}>
              <View style={styles.expCol}>
                <Text style={styles.fieldLabel}>MM</Text>
                <TextInput
                  style={styles.input}
                  placeholder="12"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={expMonth}
                  onChangeText={(t) => setExpMonth(t.replace(/\D/g, '').slice(0, 2))}
                />
              </View>
              <View style={styles.expCol}>
                <Text style={styles.fieldLabel}>YY</Text>
                <TextInput
                  style={styles.input}
                  placeholder="28"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={expYear}
                  onChangeText={(t) => setExpYear(t.replace(/\D/g, '').slice(0, 2))}
                />
              </View>
            </View>

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
  brandRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  brandChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  brandChipOn: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  brandChipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  brandChipTextOn: { color: '#2563eb' },
  expRow: { flexDirection: 'row', gap: 12 },
  expCol: { flex: 1 },
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
