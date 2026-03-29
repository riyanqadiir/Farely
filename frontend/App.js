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
import RideOptionsScreen from './src/screens/RideOptionsScreen';
import ChatScreen from './src/screens/ChatScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import WalletScreen from './src/screens/WalletScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { ActivityIndicator, View } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

const TAB_ICON_SIZE = 24;

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

/** fa-regular (inactive) vs fa-solid (active); no background chip. */
function TabIcon({ focused, name }) {
  const color = focused ? '#2563eb' : '#64748b';
  return focused ? (
    <FontAwesome6 name={name} size={TAB_ICON_SIZE} color={color} solid />
  ) : (
    <FontAwesome6 name={name} size={TAB_ICON_SIZE} color={color} regular />
  );
}

const tabBarScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: '#2563eb',
  tabBarInactiveTintColor: '#64748b',
  tabBarStyle: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
  },
};

const MainTab = () => (
  <Tab.Navigator screenOptions={tabBarScreenOptions}>
    <Tab.Screen
      name="Rides"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="car" />,
      }}
    />
    <Tab.Screen
      name="Wallet"
      component={WalletScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="wallet" />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="user" />,
      }}
    />
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
              <Stack.Screen name="RideOptions" component={RideOptionsScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="Payment" component={PaymentScreen} />
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
