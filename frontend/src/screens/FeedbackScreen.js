import React, { useMemo, useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRoute } from '@react-navigation/native';
import { navigationRef } from '../navigation/rootNavigation';
import { useTheme } from '../theme/ThemeContext';
import farelyApi from '../api/farelyApi';
import { showAppToast } from '../utils/appToast';
import { AuthContext } from '../context/AuthContext';

function goBack() {
  if (navigationRef.isReady()) {
    if (navigationRef.canGoBack()) navigationRef.goBack();
    else navigationRef.navigate('Main', { screen: 'Rides' });
  }
}

const FeedbackScreen = () => {
  const route = useRoute();
  const { colors } = useTheme();
  const { user } = useContext(AuthContext);
  const params = route.params || {};
  const source = params.source || 'menu';
  const handoffId = params.handoffId || null;
  const provider = params.provider || null;
  const styles = useMemo(() => createStyles(), []);

  const [stars, setStars] = useState(0);
  const [appExp, setAppExp] = useState('');
  const [valueNote, setValueNote] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (stars < 1 || stars > 5) {
      showAppToast({ title: 'Pick a star rating', body: 'Tap 1–5 stars above.', tone: 'error' });
      return;
    }
    if (appExp.trim().length < 3 || valueNote.trim().length < 3) {
      showAppToast({ title: 'Add a few words', body: 'Both fields need a short note.', tone: 'error' });
      return;
    }
    if (!user) {
      showAppToast({ title: 'Sign in required', body: 'Please sign in to send feedback.', tone: 'error' });
      return;
    }
    setSending(true);
    try {
      await farelyApi.post('/feedback', {
        stars,
        appExperience: appExp.trim(),
        timeSavingNote: valueNote.trim(),
        source: String(source).slice(0, 64),
        handoffId,
        provider,
      });
      showAppToast({ title: 'Thanks for your feedback', body: 'Your notes help us improve Farely.', tone: 'success' });
      goBack();
    } catch (e) {
      showAppToast({ title: 'Could not send', body: e?.response?.data?.message || 'Try again shortly.', tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.85}>
            <FontAwesome6 name="chevron-left" size={14} color={colors.accent} solid />
            <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Feedback</Text>
          <View style={{ width: 64 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.lead, { color: colors.textSecondary }]}>
            How was your Farely experience? Your star rating and notes reach our team in the admin dashboard.
          </Text>
          {!!provider && source === 'ride_confirm' && (
            <Text style={[styles.tag, { color: colors.textMuted, backgroundColor: colors.chipInactive }]}>After {provider} ride</Text>
          )}
          <Text style={[styles.label, { color: colors.text }]}>Overall rating</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setStars(n)}
                style={styles.starBtn}
                hitSlop={8}
                activeOpacity={0.85}
              >
                <FontAwesome6
                  name="star"
                  size={32}
                  color={n <= stars ? colors.accent : colors.border}
                  solid={n <= stars}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.text }]}>App &amp; platform experience</Text>
          <TextInput
            style={[
              styles.input,
              styles.multiline,
              { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
            placeholder="Navigation, search, clarity — what worked or didn’t?"
            placeholderTextColor={colors.textMuted}
            multiline
            value={appExp}
            onChangeText={setAppExp}
            textAlignVertical="top"
          />
          <Text style={[styles.label, { color: colors.text, marginTop: 14 }]}>How Farely helped &amp; time saved</Text>
          <TextInput
            style={[
              styles.input,
              styles.multiline,
              { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
            placeholder="e.g. comparing prices quickly, one place for providers…"
            placeholderTextColor={colors.textMuted}
            multiline
            value={valueNote}
            onChangeText={setValueNote}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.submit, { backgroundColor: colors.accent, opacity: sending ? 0.7 : 1 }]}
            onPress={submit}
            disabled={sending}
            activeOpacity={0.9}
          >
            {sending ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={[styles.submitText, { color: colors.onAccent }]}>Send feedback</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default FeedbackScreen;

function createStyles() {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1 },
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
      borderBottomWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 88 },
    backText: { fontWeight: '800', fontSize: 12 },
    title: { fontSize: 18, fontWeight: '900' },
    scroll: { padding: 16, paddingBottom: 32 },
    lead: { fontSize: 14, lineHeight: 21, fontWeight: '600', marginBottom: 12 },
    tag: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
    label: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
    starsRow: { flexDirection: 'row', gap: 6, marginBottom: 20, justifyContent: 'space-between' },
    starBtn: { padding: 4 },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      fontWeight: '600',
    },
    multiline: { minHeight: 100, maxHeight: 200 },
    submit: { marginTop: 22, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    submitText: { fontSize: 16, fontWeight: '900' },
  });
}
