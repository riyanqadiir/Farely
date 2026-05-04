import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import farelyApi from '../api/farelyApi';
import { AuthContext } from '../context/AuthContext';
import { showAppToast } from '../utils/appToast';

const FAQ = [
  {
    q: 'How are fares calculated?',
    a: 'Fares combine a base rate for your vehicle type, distance, and provider-specific pricing. Estimates shown before booking are indicative and may differ slightly from the final charge.',
  },
  {
    q: 'How do I pay?',
    a: 'Farely does not collect fares. After you open Yango or Bykea, payment and checkout happen only inside that provider’s app.',
  },
  {
    q: 'Who do I contact for a lost item?',
    a: 'Email farely.support@gmail.com with your trip time, pickup and drop-off, and a description of the item. We will coordinate with the driver when possible.',
  },
];

function subjectFromBody(body) {
  const t = body.trim();
  if (!t) return 'Support request';
  const first = t.split(/\n/).find((line) => line.trim().length > 0) || t;
  return first.length > 120 ? `${first.slice(0, 117)}…` : first.trim();
}

const HelpSupportScreen = ({ navigation }) => {
  const [open, setOpen] = useState(0);
  const { user } = useContext(AuthContext);
  const [ticketBody, setTicketBody] = useState('');
  const [sendingTicket, setSendingTicket] = useState(false);

  const submitTicket = async () => {
    const description = ticketBody.trim();
    if (description.length < 10) {
      showAppToast({
        title: 'Add a bit more detail',
        body: 'Please write at least a few words so we can help.',
        tone: 'error',
      });
      return;
    }
    if (!user) {
      showAppToast({ title: 'Sign in required', body: 'Please sign in to send a request.', tone: 'error' });
      return;
    }
    setSendingTicket(true);
    try {
      await farelyApi.post('/support/tickets', {
        subject: subjectFromBody(description),
        description,
        category: 'other',
        priority: 'medium',
      });
      setTicketBody('');
      showAppToast({
        title: 'Request sent',
        body: 'Our team can see this in Support Inbox. You can still email farely.support@gmail.com if you prefer.',
        tone: 'success',
      });
    } catch (e) {
      showAppToast({
        title: 'Could not send',
        body: e?.response?.data?.message || 'Check your connection and try again.',
        tone: 'error',
      });
    } finally {
      setSendingTicket(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={14} color="#2563eb" solid />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Help & support</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => Linking.openURL('mailto:farely.support@gmail.com?subject=Farely%20support')}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="envelope" size={18} color="#2563eb" solid />
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>Email us</Text>
              <Text style={styles.contactSub}>farely.support@gmail.com</Text>
            </View>
            <FontAwesome6 name="chevron-right" size={12} color="#94a3b8" solid />
          </TouchableOpacity>

          <View style={styles.inlineForm}>
            <Text style={styles.inlineFormTitle}>Message from the app</Text>
            <Text style={styles.inlineFormHint}>
              This goes to the Farely backend and shows in Admin Support Inbox (in-app). Official email is unchanged.
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe your problem — e.g. payment, account, or a ride issue…"
              placeholderTextColor="#94a3b8"
              value={ticketBody}
              onChangeText={setTicketBody}
              multiline
              textAlignVertical="top"
              editable={!sendingTicket}
              maxLength={4000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, sendingTicket && styles.sendBtnDisabled]}
              onPress={submitTicket}
              disabled={sendingTicket}
              activeOpacity={0.88}
            >
              {sendingTicket ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendBtnText}>Send to Farely</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.section}>Common questions</Text>
        {FAQ.map((item, i) => (
          <View key={item.q} style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqHead}
              onPress={() => setOpen(open === i ? -1 : i)}
              activeOpacity={0.85}
            >
              <Text style={styles.faqQ}>{item.q}</Text>
              <FontAwesome6 name={open === i ? 'chevron-up' : 'chevron-down'} size={12} color="#64748b" solid />
            </TouchableOpacity>
            {open === i && <Text style={styles.faqA}>{item.a}</Text>}
          </View>
        ))}

        <Text style={styles.section}>More</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Terms')}>
          <Text style={styles.linkText}>Terms of service</Text>
          <FontAwesome6 name="chevron-right" size={12} color="#94a3b8" solid />
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.linkText}>Privacy policy</Text>
          <FontAwesome6 name="chevron-right" size={12} color="#94a3b8" solid />
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default HelpSupportScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
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
  scroll: { padding: 16, paddingBottom: 32 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 20,
  },
  contactTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  contactSub: { fontSize: 13, color: '#2563eb', fontWeight: '700', marginTop: 2 },
  inlineForm: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 20,
  },
  inlineFormTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  inlineFormHint: { fontSize: 12, color: '#64748b', fontWeight: '600', lineHeight: 17, marginBottom: 12 },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  sendBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0f172a' },
  faqA: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 8,
  },
  linkText: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
});
