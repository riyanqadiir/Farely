import React, { useContext, useState, useEffect, useMemo } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
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
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import LocationSearchScreen from './src/screens/LocationSearchScreen';
import MenuScreen from './src/screens/MenuScreen';
import AboutScreen from './src/screens/AboutScreen';
import AccountSettingsScreen from './src/screens/AccountSettingsScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import AppSettingsScreen from './src/screens/AppSettingsScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import RideHistoryScreen from './src/screens/RideHistoryScreen';
import RideReviewScreen from './src/screens/RideReviewScreen';
import AccountBlockedScreen from './src/screens/AccountBlockedScreen';
import {
  ActivityIndicator,
  View,
  Linking,
  Alert,
  AppState,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { RideWidgetProvider } from './src/context/RideWidgetContext';
import RideWidget from './src/components/RideWidget';
import AppToastHost from './src/components/AppToastHost';
import { navigationRef } from './src/navigation/rootNavigation';
import { parseProviderReturnUrl } from './src/utils/providerRedirect';
import farelyApi from './src/api/farelyApi';
import { pushAppNotification } from './src/utils/notifications';
import {
  getPendingRideConfirmation,
  removePendingRideConfirmation,
  patchPendingRideConfirmation,
} from './src/utils/rideConfirmation';
import { syncCaptureForPendingHandoff } from './src/utils/handoffCaptureSync';
import { showAppToast } from './src/utils/appToast';
import { clearActiveCaptureHandoff } from './src/utils/activeCaptureHandoff';
import { subscribeToUiData } from './src/native/accessibilityBridge';
import {
  applyLiveCaptureEvent,
  drainBufferedUiCapture,
  parseUiDataCapture,
} from './src/utils/liveCapturePipeline';
import { createLiveCaptureDebouncer } from './src/utils/liveCaptureDebounced';

const TAB_ICON_SIZE = 24;

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

/** fa-regular (inactive) vs fa-solid (active). */
function TabIcon({ focused, name, activeColor, inactiveColor }) {
  const color = focused ? activeColor : inactiveColor;
  return focused ? (
    <FontAwesome6 name={name} size={TAB_ICON_SIZE} color={color} solid />
  ) : (
    <FontAwesome6 name={name} size={TAB_ICON_SIZE} color={color} regular />
  );
}

function MainTab() {
  const { colors, isDark } = useTheme();
  const tabBarScreenOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: true,
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: {
        backgroundColor: colors.tabBar,
        borderTopColor: colors.tabBorder,
        borderTopWidth: 1,
      },
      tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
    }),
    [colors, isDark]
  );

  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen
        name="Rides"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              name="car"
              activeColor={colors.accent}
              inactiveColor={colors.textMuted}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              name="user"
              activeColor={colors.accent}
              inactiveColor={colors.textMuted}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const AppNavigator = () => {
  const { user, loading, pendingProfileComplete, sessionInvalidation } = useContext(AuthContext);
  const { colors, isDark } = useTheme();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(null);
  const [pendingPrompt, setPendingPrompt] = useState(null);

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: colors.accent,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    }),
    [colors, isDark]
  );

  useEffect(() => {
    AsyncStorage.getItem('onboardingSeen').then((val) => {
      setHasSeenOnboarding(val === 'true');
    });
  }, []);

  const mergePendingWithCapture = async (pending) => {
    if (!pending?.handoffId) return pending;
    await drainBufferedUiCapture();
    if (typeof pending.capturedFare === 'number' && pending.capturedFare > 0) return pending;
    const synced = await syncCaptureForPendingHandoff(pending);
    if (!synced?.capturedFare) return pending;
    await patchPendingRideConfirmation(pending.handoffId, synced);
    return { ...pending, ...synced };
  };

  const confirmPendingRide = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    let pending = await getPendingRideConfirmation();
    if (!pending?.handoffId) return;
    pending = await mergePendingWithCapture(pending);
    setPendingPrompt((prev) => {
      if (prev?.handoffId && prev.handoffId !== pending.handoffId) return prev;
      if (prev?.handoffId === pending.handoffId) return { ...prev, ...pending };
      return pending;
    });
  };

  useEffect(() => {
    if (!user) return;
    const ping = () => {
      farelyApi.post('/profile/heartbeat').catch(() => null);
    };
    ping();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') ping();
    });
    return () => sub.remove();
  }, [user]);

  /** Do not surface ride-review UI while logged out (stale AsyncStorage survives reinstall in dev / token cleared). */
  useEffect(() => {
    if (loading) return;
    if (!user) setPendingPrompt(null);
  }, [user, loading]);

  /** After login, re-check persisted pending handoff prompt. */
  useEffect(() => {
    if (loading || !user) return;
    void confirmPendingRide();
  }, [loading, user]);

  /** Global capture: persists fares while RideOptions is unmounted / JS was backgrounded. */
  useEffect(() => {
    if (Platform.OS !== 'android' || !user) return;
    const debouncer = createLiveCaptureDebouncer(450);
    const sub = subscribeToUiData((data) => {
      const capture = parseUiDataCapture(data);
      if (!capture) return;
      debouncer.schedule(capture, async (job) => {
        await applyLiveCaptureEvent(job);
      });
    });
    return () => {
      sub.remove();
      debouncer.clear();
    };
  }, [user]);

  const decidePendingRide = async (taken) => {
    let pending = pendingPrompt;
    if (!pending?.handoffId) return;
    setPendingPrompt(null);
    pending = await mergePendingWithCapture(pending);
    try {
      await farelyApi.post('/rides/ride-handoff/confirm', {
        handoffId: pending.handoffId,
        taken,
        ...(typeof pending.capturedFare === 'number' && pending.capturedFare > 0
          ? {
              capturedFare: Math.round(pending.capturedFare),
              capturedProvider: pending.capturedProvider || pending.provider,
            }
          : {}),
      });
      await removePendingRideConfirmation(pending.handoffId);
      await clearActiveCaptureHandoff();
      pushAppNotification({
        type: 'ride',
        title: taken ? 'Ride confirmed' : 'Ride not confirmed',
        body: taken
          ? `${pending.provider || 'Provider'} ride added to your history.`
          : `${pending.provider || 'Provider'} ride was marked as not taken.`,
        meta: { handoffId: pending.handoffId },
      });
      if (taken) {
        showAppToast({
          title: 'Ride saved',
          body: `${pending.provider || 'Provider'} added to history. Share quick feedback?`,
          tone: 'success',
          actionLabel: 'Rate experience',
          onAction: () => {
            if (navigationRef.isReady()) {
              navigationRef.navigate('Feedback', {
                source: 'ride_confirm',
                handoffId: pending.handoffId,
                provider: pending.provider || undefined,
              });
            }
          },
        });
      } else {
        showAppToast({
          title: 'Not saved in history',
          body: `${pending.provider || 'Provider'} ride marked as not taken.`,
          tone: 'info',
        });
      }
    } catch (_) {
      showAppToast({ title: 'Could not update', body: 'Please try again.', tone: 'error' });
      setPendingPrompt(pending);
    }
  };

  useEffect(() => {

    const handleUrl = async (url) => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const payload = parseProviderReturnUrl(url);
      if (!payload) return;
      if (payload.returnedPrice) {
        showAppToast({
          title: 'Provider callback received',
          body: `${payload.provider} returned ${payload.returnedCurrency || ''} ${payload.returnedPrice}`.trim(),
          tone: 'success',
        });
      } else {
        showAppToast({
          title: 'Returned from provider',
          body: `${payload.provider || 'Provider'} returned to Farely.`,
          tone: 'info',
        });
      }
      setTimeout(() => {
        void confirmPendingRide();
      }, 900);
    };

    Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    }).catch(() => null);

    const sub = Linking.addEventListener('url', (event) => {
      if (event?.url) void handleUrl(event.url);
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setTimeout(() => {
          void confirmPendingRide();
        }, 900);
      }
    });

    return () => {
      sub.remove();
      appStateSub.remove();
    };
  }, [pendingPrompt?.handoffId]);

  if (loading || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.accent} />
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
  // A live block/deletion takes priority over both the auth and the
  // signed-in stacks: the user lands directly on the lock-out screen.
  const isInvalidated = !!sessionInvalidation;

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <Stack.Navigator
          key={isInvalidated ? 'invalidated' : user ? 'authenticated' : 'unauthenticated'}
          screenOptions={stackScreenOptions}
          initialRouteName={
            isInvalidated ? 'AccountBlocked' : user ? initialUserRoute : initialAuthRoute
          }
        >
          {isInvalidated ? (
            <Stack.Screen
              name="AccountBlocked"
              component={AccountBlockedScreen}
              options={{ gestureEnabled: false }}
            />
          ) : user ? (
            <>
              <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
              <Stack.Screen name="Main" component={MainTab} />
              <Stack.Screen name="RideOptions" component={RideOptionsScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="Notification" component={NotificationScreen} />
              <Stack.Screen name="LocationSearch" component={LocationSearchScreen} />
              <Stack.Screen name="Menu" component={MenuScreen} />
              <Stack.Screen name="About" component={AboutScreen} />
              <Stack.Screen
                name="MenuProfile"
                component={ProfileScreen}
                initialParams={{ fromMenu: true }}
              />
              <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
              <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
              <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
              <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
              <Stack.Screen name="Feedback" component={FeedbackScreen} />
              <Stack.Screen name="Terms" component={TermsScreen} />
              <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
              <Stack.Screen name="RideHistory" component={RideHistoryScreen} />
              <Stack.Screen name="RideReview" component={RideReviewScreen} />
              <Stack.Screen name="ForgotPasswordSend" component={ForgotPasswordSendScreen} />
              <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
              <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
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
        <AppToastHost />
        <RideConfirmModal
          pending={user ? pendingPrompt : null}
          colors={colors}
          onLater={() => {
            if (pendingPrompt?.provider) {
              pushAppNotification({
                type: 'ride',
                title: 'Ride review pending',
                body: `Review your ${pendingPrompt.provider} ride later in Menu > Pending ride reviews.`,
                meta: { handoffId: pendingPrompt.handoffId, action: 'review_ride' },
              });
            }
            setPendingPrompt(null);
          }}
          onNo={() => decidePendingRide(false)}
          onYes={() => decidePendingRide(true)}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

function RideConfirmModal({ pending, colors, onLater, onNo, onYes }) {
  if (!pending?.handoffId) return null;
  const fromText = pending.pickup || 'Pickup location';
  const toText = pending.destination || 'Drop-off location';
  const provider = pending.provider || 'provider';
  const estimateFare =
    typeof pending.estimatedFare === 'number' && Number.isFinite(pending.estimatedFare)
      ? pending.estimatedFare
      : null;
  const liveFare =
    typeof pending.capturedFare === 'number' && Number.isFinite(pending.capturedFare)
      ? pending.capturedFare
      : null;
  return (
    <Modal transparent animationType="fade" visible>
      <View style={modalStyles.overlay}>
        <TouchableOpacity style={modalStyles.backdrop} activeOpacity={1} onPress={onLater} />
        <View style={[modalStyles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong }]}>
          <Text style={[modalStyles.title, { color: colors.text }]}>Confirm your trip</Text>
          <Text style={[modalStyles.body, { color: colors.textSecondary }]}>
            Did you take this {provider} ride?
          </Text>

          <View style={[modalStyles.routeBoard, { backgroundColor: colors.chipInactive, borderColor: colors.border }]}>
            <View style={modalStyles.routeLineWrap}>
              <View style={[modalStyles.pin, { backgroundColor: colors.accent }]} />
              <View style={[modalStyles.line, { backgroundColor: colors.accentSoft }]} />
              <View style={[modalStyles.pin, { backgroundColor: colors.success }]} />
            </View>
            <View style={modalStyles.routeTextWrap}>
              <Text style={[modalStyles.routeLabel, { color: colors.textMuted }]}>From</Text>
              <Text style={[modalStyles.routeText, { color: colors.text }]} numberOfLines={1}>{fromText}</Text>
              <Text style={[modalStyles.routeLabel, { color: colors.textMuted, marginTop: 8 }]}>To</Text>
              <Text style={[modalStyles.routeText, { color: colors.text }]} numberOfLines={1}>{toText}</Text>
            </View>
          </View>

          {liveFare != null || estimateFare != null ? (
            <View style={[modalStyles.fareRow, { borderColor: colors.border }]}>
              {estimateFare != null ? (
                <Text style={[modalStyles.fareMeta, { color: colors.textMuted }]}>
                  Farely estimate: PKR {Math.round(estimateFare)}
                </Text>
              ) : null}
              {liveFare != null ? (
                <Text style={[modalStyles.fareLive, { color: colors.accent }]}>
                  Captured in {provider}: PKR {Math.round(liveFare)}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={modalStyles.actions}>
            <TouchableOpacity
              style={[modalStyles.ghostBtn, { borderColor: colors.borderStrong, backgroundColor: colors.chipInactive }]}
              onPress={onLater}
            >
              <Text style={[modalStyles.ghostText, { color: colors.textSecondary }]}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.ghostBtn, { borderColor: colors.borderStrong, backgroundColor: colors.chipInactive }]}
              onPress={onNo}
            >
              <Text style={[modalStyles.ghostText, { color: colors.textSecondary }]}>No</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[modalStyles.primaryBtn, { backgroundColor: colors.accent }]} onPress={onYes}>
              <Text style={[modalStyles.primaryText, { color: colors.onAccent }]}>Yes, I took it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Reads auth and passes primitives into RideWidgetProvider so widget context keeps stable hook order. */
function RideWidgetAuthBridge({ children }) {
  const { user, loading } = useContext(AuthContext);
  return (
    <RideWidgetProvider authUser={user} authLoading={loading}>
      {children}
    </RideWidgetProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RideWidgetAuthBridge>
          <AppNavigator />
        </RideWidgetAuthBridge>
      </AuthProvider>
    </ThemeProvider>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  card: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  title: { fontSize: 21, fontWeight: '900' },
  body: { marginTop: 4, fontSize: 13, fontWeight: '700' },
  routeBoard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    gap: 10,
  },
  routeLineWrap: { width: 16, alignItems: 'center', paddingTop: 4 },
  pin: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, flex: 1, marginVertical: 3, borderRadius: 3 },
  routeTextWrap: { flex: 1 },
  routeLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  routeText: { marginTop: 2, fontSize: 13, fontWeight: '700' },
  fareRow: {
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 4,
  },
  fareMeta: { fontSize: 12, fontWeight: '700' },
  fareLive: { fontSize: 13, fontWeight: '900' },
  actions: { marginTop: 14, flexDirection: 'row', gap: 8 },
  ghostBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontWeight: '800', fontSize: 12 },
  primaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryText: { fontWeight: '900', fontSize: 12 },
});
