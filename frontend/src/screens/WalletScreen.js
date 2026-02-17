import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import farelyApi from '../api/farelyApi';
import { AuthContext } from '../context/AuthContext';

const WalletScreen = () => {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const balRes = await farelyApi.get('/wallet/balance');
      setBalance(balRes.data.balance);
      const histRes = await farelyApi.get('/wallet/history');
      setHistory(histRes.data);
    } catch (err) {
      console.log('Error fetching wallet data');
    }
  };

  const handleTopup = async () => {
    if (!amount || isNaN(amount)) return alert('Enter valid amount');
    setLoading(true);
    try {
      await farelyApi.post('/wallet/topup', { amount: parseInt(amount), method: 'JazzCash' });
      setAmount('');
      fetchWalletData();
      alert('Top-up successful!');
    } catch (err) {
      alert('Top-up failed');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
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
        />
        <TouchableOpacity style={styles.topupBtn} onPress={handleTopup} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.topupBtnText}>Top-up with JazzCash</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.historyTitle}>Transaction History</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item._id}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa', padding: 20 },
  balanceCard: { backgroundColor: '#2ecc71', padding: 30, borderRadius: 15, alignItems: 'center', marginBottom: 25 },
  balanceLabel: { color: '#fff', fontSize: 16 },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginTop: 10 },
  topupSection: { backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 2, marginBottom: 25 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 15 },
  topupBtn: { backgroundColor: '#34495e', padding: 15, borderRadius: 8, alignItems: 'center' },
  topupBtnText: { color: '#fff', fontWeight: 'bold' },
  historyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10 },
  historyType: { fontWeight: 'bold' },
  historyDate: { color: '#7f8c8d', fontSize: 12 },
  historyAmount: { fontWeight: 'bold', fontSize: 16 },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#95a5a6' }
});

export default WalletScreen;
