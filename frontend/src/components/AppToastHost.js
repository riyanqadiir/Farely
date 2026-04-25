import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { registerAppToastListener } from '../utils/appToast';

const HIDE_DEFAULT_MS = 2200;
const HIDE_WITH_ACTION_MS = 9000;

const AppToastHost = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const [toast, setToast] = useState(null);
  const y = useRef(new Animated.Value(-30)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef(null);

  useEffect(() => {
    const unregister = registerAppToastListener((next) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({
        title: next.title || 'Notice',
        body: next.body || '',
        tone: next.tone || 'info',
        actionLabel: next.actionLabel || null,
        onAction: typeof next.onAction === 'function' ? next.onAction : null,
      });
    });
    return () => {
      unregister?.();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    y.setValue(-30);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(y, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    const hideAfter = toast?.onAction && toast?.actionLabel ? HIDE_WITH_ACTION_MS : HIDE_DEFAULT_MS;
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(y, {
          toValue: -16,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => setToast(null));
    }, hideAfter);
  }, [toast, opacity, y]);

  if (!toast) return null;

  const toneBg = toast.tone === 'success'
    ? colors.success
    : toast.tone === 'error'
      ? colors.danger
      : colors.accent;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Animated.View
        pointerEvents="auto"
        style={[
          styles.toast,
          {
            backgroundColor: toneBg,
            borderColor: colors.borderStrong,
            transform: [{ translateY: y }],
            opacity,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.onAccent }]} numberOfLines={1}>
          {toast.title}
        </Text>
        {!!toast.body && (
          <Text style={[styles.body, { color: colors.onAccent }]} numberOfLines={3}>
            {toast.body}
          </Text>
        )}
        {!!toast.actionLabel && toast.onAction && (
          <TouchableOpacity
            onPress={() => {
              if (hideTimer.current) clearTimeout(hideTimer.current);
              setToast(null);
              try {
                toast.onAction();
              } catch (_) {}
            }}
            style={styles.actionBtn}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionText, { color: colors.onAccent }]}>{toast.actionLabel}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

export default AppToastHost;

function createStyles() {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 56,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 999,
      elevation: 999,
      paddingHorizontal: 16,
    },
    toast: {
      width: '100%',
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 11,
      paddingHorizontal: 12,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    title: { fontSize: 14, fontWeight: '900' },
    body: { marginTop: 3, fontSize: 12, fontWeight: '600', lineHeight: 16 },
    actionBtn: {
      marginTop: 10,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.12)',
    },
    actionText: { fontSize: 13, fontWeight: '900' },
  });
}
