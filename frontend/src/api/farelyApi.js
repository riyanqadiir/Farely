import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const farelyApi = axios.create({
  baseURL: 'http://localhost:5000/api', // For Android emulator, use 10.0.2.2 or your local IP
});

farelyApi.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (err) => {
    return Promise.reject(err);
  }
);

export default farelyApi;
