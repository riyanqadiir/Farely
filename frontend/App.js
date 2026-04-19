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
import NotificationScreen from './src/screens/NotificationScreen';
import LocationSearchScreen from './src/screens/LocationSearchScreen';
import MenuScreen from './src/screens/MenuScreen';
import AboutScreen from './src/screens/AboutScreen';
import AccountSettingsScreen from './src/screens/AccountSettingsScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import PaymentMethodsScreen from './src/screens/PaymentMethodsScreen';
import CardSettingsScreen from './src/screens/CardSettingsScreen';
import AppSettingsScreen from './src/screens/AppSettingsScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import { ActivityIndicator, View, Linking, Alert } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { RideWidgetProvider } from './src/context/RideWidgetContext';
import RideWidget from './src/components/RideWidget';
import { navigationRef } from './src/navigation/rootNavigation';
import { StripeProvider, initStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { parseProviderReturnUrl } from './src/utils/providerRedirect';

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
  lazy: true,
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

  useEffect(() => {
    const handleUrl = (url) => {
      const payload = parseProviderReturnUrl(url);
      if (!payload) return;
      if (payload.returnedPrice) {
        Alert.alert(
          'Provider callback received',
          `${payload.provider} returned ${payload.returnedCurrency || ''} ${payload.returnedPrice}`.trim()
        );
      } else {
        Alert.alert(
          'Returned from provider',
          `${payload.provider || 'Provider'} returned to Farely. Live fare callback may not be supported.`
        );
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    }).catch(() => null);

    const sub = Linking.addEventListener('url', (event) => {
      if (event?.url) handleUrl(event.url);
    });

    return () => {
      sub.remove();
    };
  }, []);

  if (loading || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const stackScreenOptions = {
    headerShown: false,
    gestureEnabled: true,
    cardOverlayEnabled: true,
    detachInactiveScreens: true,
  };
  const initialAuthRoute = hasSeenOnboarding ? 'Welcome' : 'Onboarding';
  const initialUserRoute = pendingProfileComplete ? 'CompleteProfile' : 'Main';

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          key={user ? 'authenticated' : 'unauthenticated'}
          screenOptions={stackScreenOptions}
          initialRouteName={user ? initialUserRoute : initialAuthRoute}
        >
          {user ? (
            <>
              <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
              <Stack.Screen name="Main" component={MainTab} />
              <Stack.Screen name="RideOptions" component={RideOptionsScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="Payment" component={PaymentScreen} />
              <Stack.Screen name="Notification" component={NotificationScreen} />
              <Stack.Screen name="LocationSearch" component={LocationSearchScreen} />
              <Stack.Screen name="Menu" component={MenuScreen} />
              <Stack.Screen name="About" component={AboutScreen} />
              <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
              <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
              <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
              <Stack.Screen name="CardSettings" component={CardSettingsScreen} />
              <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
              <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
              <Stack.Screen name="Terms" component={TermsScreen} />
              <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
              <Stack.Screen name="ForgotPasswordSend" component={ForgotPasswordSendScreen} />
              <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
              <Stack.Screen name="ForgotPasswordSetNew" component={ForgotPasswordSetNewScreen} />
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
        <RideWidget navigationRef={navigationRef} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default function App() {
  const stripePublishableKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    Constants?.expoConfig?.extra?.stripePublishableKey ||
    '';

  useEffect(() => {
    if (!stripePublishableKey) {
      console.warn('Stripe publishable key is missing.');
      return;
    }
    initStripe({ publishableKey: stripePublishableKey }).catch((err) => {
      console.warn('Stripe init failed', err?.message || err);
    });
  }, [stripePublishableKey]);

  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <AuthProvider>
        <RideWidgetProvider>
          <AppNavigator />
        </RideWidgetProvider>
      </AuthProvider>
    </StripeProvider>
  );
}
