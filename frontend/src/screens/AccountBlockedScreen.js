import React, { useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';

const SUPPORT_EMAIL = 'farely.support@gmail.com';

function formatBlockedUntil(blockedUntil) {
  if (!blockedUntil) return null;
  const d = new Date(blockedUntil);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (_) {
    return d.toISOString();
  }
}

const AccountBlockedScreen = () => {
  const { sessionInvalidation, dismissSessionInvalidation } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isDeleted = sessionInvalidation?.kind === 'deleted';
  const reason = sessionInvalidation?.reason || null;
  const blockedUntil = sessionInvalidation?.blockedUntil || null;
  const isPermanent = !isDeleted && sessionInvalidation?.kind === 'blocked' && !blockedUntil;
  const untilLabel = formatBlockedUntil(blockedUntil);

  const title = isDeleted
    ? 'Your account is no longer available'
    : isPermanent
      ? 'Your account has been permanently restricted'
      : 'Your account is temporarily restricted';

  const subtitle = isDeleted
    ? 'This account was removed by Farely support. Please sign up again or contact us if you believe this is a mistake.'
    : isPermanent
      ? 'An administrator has placed a permanent hold on this account. You will not be able to sign in or book rides.'
      : 'An administrator has placed a temporary hold on this account. You will be able to sign in again after the restriction is lifted.';

  const openSupport = () => {
    const subject = encodeURIComponent(isDeleted ? 'Account removal' : 'Account access restricted');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
    Linking.openURL(url).catch(() => null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <FontAwesome6
            name={isDeleted ? 'circle-xmark' : 'shield-halved'}
            size={36}
            color={colors.danger}
            solid
          />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.detailCard}>
          {reason ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reason</Text>
              <Text style={styles.detailValue}>{reason}</Text>
            </View>
          ) : null}

          {!isDeleted && untilLabel ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Access restored</Text>
              <Text style={styles.detailValue}>{untilLabel}</Text>
            </View>
          ) : null}

          {!isDeleted && isPermanent ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={[styles.detailValue, { color: colors.danger }]}>Permanent</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={openSupport} activeOpacity={0.85}>
          <FontAwesome6 name="envelope" size={16} color={colors.onAccent} solid />
          <Text style={styles.primaryBtnText}>Contact support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={dismissSessionInvalidation}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>
            {isDeleted ? 'Back to sign up' : 'Back to sign in'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 32,
      justifyContent: 'center',
    },
    iconWrap: {
      alignSelf: 'center',
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    detailCard: {
      marginTop: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      padding: 14,
      gap: 12,
    },
    detailRow: {
      flexDirection: 'column',
      gap: 4,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    primaryBtn: {
      marginTop: 24,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryBtnText: {
      color: colors.onAccent,
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryBtn: {
      marginTop: 10,
      borderRadius: 12,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
  });

export default AccountBlockedScreen;
