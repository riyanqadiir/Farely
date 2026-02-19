import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Linking } from 'react-native';
import farelyApi from '../api/farelyApi';
import { AuthContext } from '../context/AuthContext';

const HomeScreen = () => {
  const { logout } = useContext(AuthContext);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [fares, setFares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('fare'); // 'fare' or 'eta'

  const handleCompare = async () => {
    if (!pickup || !destination) return alert('Enter locations');
    setLoading(true);
    try {
      const res = await farelyApi.post('/rides/compare', { pickup, destination });
      let data = res.data;
      if (sortBy === 'fare') {
        data.sort((a, b) => a.fare - b.fare);
      }
      setFares(data);
    } catch (err) {
      alert('Failed to get fares');
    }
    setLoading(false);
  };

  const toggleSort = () => {
    const nextSort = sortBy === 'fare' ? 'eta' : 'fare';
    setSortBy(nextSort);
    const sorted = [...fares].sort((a, b) => {
      if (nextSort === 'fare') return a.fare - b.fare;
      return parseInt(a.eta) - parseInt(b.eta);
    });
    setFares(sorted);
  };

  const handleBook = (provider) => {
    // Deep linking logic
    let url = '';
    if (provider === 'Uber') url = 'uber://';
    else if (provider === 'Careem') url = 'careem://';
    else if (provider === 'Yango') url = 'yango://';

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        alert(`Please install ${provider} app`);
      }
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutBtnText}>Log out</Text>
      </TouchableOpacity>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Pickup Location"
          value={pickup}
          onChangeText={setPickup}
        />
        <TextInput
          style={styles.input}
          placeholder="Destination"
          value={destination}
          onChangeText={setDestination}
        />
        <TouchableOpacity style={styles.button} onPress={handleCompare} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Compare Fares</Text>}
        </TouchableOpacity>

        {fares.length > 0 && (
          <TouchableOpacity style={styles.sortBtn} onPress={toggleSort}>
            <Text style={styles.sortBtnText}>Sorted by: {sortBy === 'fare' ? 'Cheapest' : 'Fastest'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.disclaimer}>* Fares are estimates and may change on the provider's app.</Text>

      <FlatList
        data={fares}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.fareCard}>
            <View>
              <Text style={styles.providerName}>{item.provider}</Text>
              <Text style={styles.rideType}>{item.rideType} • {item.eta}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>PKR {item.fare}</Text>
              <TouchableOpacity style={styles.bookBtn} onPress={() => handleBook(item.provider)}>
                <Text style={styles.bookBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={!loading && <Text style={styles.emptyText}>Enter locations to see fares</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  logoutBtn: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  searchContainer: { padding: 20, backgroundColor: '#fff', elevation: 3 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 10 },
  button: { backgroundColor: '#2ecc71', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  sortBtn: { marginTop: 10, alignSelf: 'flex-end' },
  sortBtnText: { color: '#3498db', fontSize: 12 },
  disclaimer: { fontSize: 10, color: '#95a5a6', marginHorizontal: 20, marginTop: 10, fontStyle: 'italic' },
  fareCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 15,
    marginTop: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2
  },
  providerName: { fontSize: 18, fontWeight: 'bold' },
  rideType: { color: '#7f8c8d' },
  priceContainer: { alignItems: 'flex-end' },
  price: { fontSize: 18, fontWeight: 'bold', color: '#2ecc71', marginBottom: 5 },
  bookBtn: { backgroundColor: '#3498db', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 5 },
  bookBtnText: { color: '#fff', fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#95a5a6' }
});

export default HomeScreen;
