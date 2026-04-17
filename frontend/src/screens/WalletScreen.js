import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import farelyApi from '../api/farelyApi';
import { AuthContext } from '../context/AuthContext';
import { pushAppNotification } from '../utils/notifications';
import { fetchPaymentMethods } from '../api/paymentMethods';

const WalletScreen = ({ navigation, route }) => {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const { user } = useContext(AuthContext);
  const openedFromMenu = route?.name === 'MenuWallet';

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const balRes = await farelyApi.get('/wallet/balance');
      setBalance(balRes.data.balance);
      const histRes = await farelyApi.get('/wallet/history');
      setHistory(histRes.data);
      const methods = await fetchPaymentMethods();
      setCards(methods);
      const defaultCard = methods.find((m) => m.isDefault) || methods[0] || null;
      setSelectedCardId(defaultCard?.id || null);
    } catch (err) {
      console.log('Error fetching wallet data');
    }
  };

  const handleTopup = async () => {
    if (!amount || isNaN(amount)) return alert('Enter valid amount');
    setLoading(true);
    try {
      if (!selectedCardId) {
        alert('Please add a card first in Payment Methods.');
        return;
      }
      const topupRes = await farelyApi.post('/wallet/topup', {
        amount: parseInt(amount, 10),
        method: 'card',
        paymentMethodId: selectedCardId,
      });
      const tx = topupRes.data?.transaction;
      setLastReceipt(tx || null);
      pushAppNotification({
        type: 'transaction',
        title: 'Wallet top-up successful',
        body: `Added PKR ${parseInt(amount, 10)} to wallet.`,
        meta: { amount: parseInt(amount, 10), method: 'card' },
      });
      setAmount('');
      fetchWalletData();
      alert('Top-up successful!');
    } catch (err) {
      pushAppNotification({
        type: 'transaction',
        title: 'Wallet top-up failed',
        body: err.response?.data?.message || 'Top-up request failed. Please try again.',
        meta: { selectedCardId },
      });
      alert(err.response?.data?.message || 'Top-up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        {openedFromMenu && (
          <View style={styles.inlineHeader}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.inlineBackBtn}>
              <Text style={styles.inlineBackText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.inlineHeaderTitle}>Wallet</Text>
            <View style={{ width: 64 }} />
          </View>
        )}
        <FlatList
          data={history}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={(
            <View>
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Current Balance</Text>
                <Text style={styles.balanceAmount}>PKR {balance}</Text>
              </View>

              <View style={styles.topupSection}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter Amount"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <Text style={styles.sectionLabel}>Choose card</Text>
                <View style={styles.methodsRow}>
                  {cards.map((card) => (
                    <TouchableOpacity
                      key={card.id}
                      style={[styles.methodChip, selectedCardId === card.id ? styles.methodChipSelected : null]}
                      onPress={() => setSelectedCardId(card.id)}
                    >
                      <Text style={styles.methodChipText}>
                      {card.label || `${card.brand?.toUpperCase() || "CARD"} card`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {!cards.length && <Text style={styles.emptyText}>No cards saved. Add one in Payment Methods.</Text>}
                </View>
                <TouchableOpacity style={styles.topupBtn} onPress={handleTopup} disabled={loading || !cards.length}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.topupBtnText}>Top-up with Card</Text>}
                </TouchableOpacity>
              </View>

              {!!lastReceipt && (
                <View style={styles.receiptCard}>
                  <Text style={styles.receiptTitle}>Latest Top-up Receipt</Text>
                  <Text style={styles.receiptLine}>Transaction: {lastReceipt.transactionId}</Text>
                  <Text style={styles.receiptLine}>Method: {lastReceipt.method?.toUpperCase()}</Text>
                  <Text style={styles.receiptLine}>Amount: PKR {lastReceipt.amount}</Text>
                  <Text style={styles.receiptLine}>Status: {lastReceipt.meta?.status || 'succeeded'}</Text>
                </View>
              )}

              <Text style={styles.historyTitle}>Transaction History</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.historyItem}>
              <View>
                <Text style={styles.historyType}>{item.type === 'topup' ? 'Added Funds' : 'Ride Payment'}</Text>
                <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.historyAmount, { color: item.type === 'topup' ? '#2ecc71' : '#e74c3c' }]}>
                {item.type === 'topup' ? '+' : '-'} PKR {item.amount}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No transactions yet</Text>}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6fa' },
  container: { flex: 1, backgroundColor: '#f5f6fa', paddingHorizontal: 20 },
  listContent: { paddingTop: 16, paddingBottom: 28 },
  inlineHeader: {
    marginTop: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineBackBtn: {
    width: 64,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  inlineBackText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  inlineHeaderTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  balanceCard: { backgroundColor: '#2ecc71', padding: 30, borderRadius: 15, alignItems: 'center', marginBottom: 20, marginTop: 8 },
  balanceLabel: { color: '#fff', fontSize: 16 },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginTop: 10 },
  topupSection: { backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 2, marginBottom: 18 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 15 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 8 },
  methodsRow: { gap: 8, marginBottom: 14 },
  methodChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  methodChipSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  methodChipText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  topupBtn: { backgroundColor: '#34495e', padding: 15, borderRadius: 8, alignItems: 'center' },
  topupBtnText: { color: '#fff', fontWeight: 'bold' },
  receiptCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  receiptTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  receiptLine: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 2 },
  historyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, marginTop: 4 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10 },
  historyType: { fontWeight: 'bold' },
  historyDate: { color: '#7f8c8d', fontSize: 12 },
  historyAmount: { fontWeight: 'bold', fontSize: 16 },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#95a5a6' }
});

export default WalletScreen;
