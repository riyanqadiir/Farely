import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useFocusEffect } from '@react-navigation/native';
import {
  getPaymentMethods,
  updatePaymentMethod,
  removePaymentMethod,
} from '../utils/paymentMethodsStorage';

const CardSettingsScreen = ({ navigation, route }) => {
  const cardId = route?.params?.cardId;
  const [card, setCard] = useState(null);
  const [label, setLabel] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const list = await getPaymentMethods();
    const c = list.find((x) => x.id === cardId);
    if (!c) {
      setCard(null);
      return;
    }
    setCard(c);
    setLabel(c.label || '');
    setExpMonth(c.expMonth || '');
    setExpYear(c.expYear || '');
    setIsDefault(!!c.isDefault);
  }, [cardId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async () => {
    if (!card) return;
    const m = expMonth.replace(/\D/g, '').slice(0, 2);
    const y = expYear.replace(/\D/g, '').slice(0, 2);
    if (!label.trim()) return Alert.alert('Label required');
    if (!m || Number(m) < 1 || Number(m) > 12) return Alert.alert('Invalid month');
    if (!y || y.length !== 2) return Alert.alert('Invalid year');

    setSaving(true);
    try {
      await updatePaymentMethod(card.id, {
        label: label.trim(),
        expMonth: m.padStart(2, '0'),
        expYear: y,
        isDefault,
      });
      Alert.alert('Saved', 'Card settings updated.');
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert('Remove this card?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removePaymentMethod(cardId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!cardId) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.err}>Missing card.</Text>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Card settings</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <FontAwesome6
            name={card.brand === 'mastercard' ? 'cc-mastercard' : 'cc-visa'}
            size={32}
            color="#0f172a"
          />
          <Text style={styles.heroLabel}>{card.label}</Text>
          <Text style={styles.heroMeta}>
            •••• {card.last4} · {card.expMonth}/{card.expYear}
          </Text>
        </View>

        <Text style={styles.fieldLabel}>Card nickname</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Label" />

        <View style={styles.expRow}>
          <View style={styles.expCol}>
            <Text style={styles.fieldLabel}>Expiry MM</Text>
            <TextInput
              style={styles.input}
              value={expMonth}
              onChangeText={(t) => setExpMonth(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View style={styles.expCol}>
            <Text style={styles.fieldLabel}>YY</Text>
            <TextInput
              style={styles.input}
              value={expYear}
              onChangeText={(t) => setExpYear(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Default for payments</Text>
            <Text style={styles.switchSub}>Use this card first at checkout</Text>
          </View>
          <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ false: '#cbd5e1', true: '#93c5fd' }} />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.removeBtn} onPress={remove}>
          <FontAwesome6 name="trash" size={14} color="#dc2626" solid />
          <Text style={styles.removeBtnText}>Remove card</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CardSettingsScreen;

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
  title: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 8,
  },
  heroLabel: { marginTop: 10, fontSize: 18, fontWeight: '900', color: '#0f172a' },
  heroMeta: { marginTop: 4, fontSize: 14, color: '#64748b', fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: '#fff',
  },
  expRow: { flexDirection: 'row', gap: 12 },
  expCol: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  switchLabel: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  switchSub: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
  saveBtn: {
    marginTop: 20,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  removeBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  removeBtnText: { color: '#dc2626', fontWeight: '800', fontSize: 15 },
  err: { textAlign: 'center', marginTop: 40, color: '#64748b' },
});
