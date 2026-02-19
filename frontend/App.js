import React, { useContext, useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import VerifyOtpScreen from './src/screens/VerifyOtpScreen';
import SetPasswordScreen from './src/screens/SetPasswordScreen';
import CompleteProfileScreen from './src/screens/CompleteProfileScreen';
import ForgotPasswordSendScreen from './src/screens/ForgotPasswordSendScreen';
import ForgotPasswordSetNewScreen from './src/screens/ForgotPasswordSetNewScreen';
import HomeScreen from './src/screens/HomeScreen';
import WalletScreen from './src/screens/WalletScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { ActivityIndicator, View } from 'react-native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTab = () => (
  <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
    <Tab.Screen name="Rides" component={HomeScreen} />
    <Tab.Screen name="Wallet" component={WalletScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { user, loading, pendingProfileComplete } = useContext(AuthContext);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('onboardingSeen').then((val) => {
      setHasSeenOnboarding(val === 'true');
    });
  }, []);

  if (loading || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const screenOptions = { headerShown: false };
  const initialAuthRoute = hasSeenOnboarding ? 'Welcome' : 'Onboarding';
  const initialUserRoute = pendingProfileComplete ? 'CompleteProfile' : 'Main';

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={screenOptions}
          initialRouteName={user ? initialUserRoute : initialAuthRoute}
        >
          {user ? (
            <>
              <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
              <Stack.Screen name="Main" component={MainTab} />
            </>
          ) : (
            <>
              {!hasSeenOnboarding && (
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              )}
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
              <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
              <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
              <Stack.Screen name="ForgotPasswordSend" component={ForgotPasswordSendScreen} />
              <Stack.Screen name="ForgotPasswordSetNew" component={ForgotPasswordSetNewScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
