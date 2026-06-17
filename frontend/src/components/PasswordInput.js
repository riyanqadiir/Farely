import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { colors } from '../constants/theme';

/**
 * Password field with visible text color (secure dots show on Android) and eye toggle.
 */
export default function PasswordInput({
  value,
  onChangeText,
  placeholder = 'Password',
  containerStyle,
  inputStyle,
  visible: controlledVisible,
  onToggleVisible,
}) {
  const [internalVisible, setInternalVisible] = useState(false);
  const visible = typeof controlledVisible === 'boolean' ? controlledVisible : internalVisible;

  const toggle = () => {
    if (onToggleVisible) onToggleVisible();
    else setInternalVisible((v) => !v);
  };

  return (
    <View style={[styles.wrap, containerStyle]}>
      <TextInput
        style={[styles.input, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={visible ? 'none' : 'password'}
        autoComplete="password"
      />
      <TouchableOpacity
        style={styles.eyeBtn}
        onPress={toggle}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <FontAwesome6
          name={visible ? 'eye-slash' : 'eye'}
          size={18}
          color={colors.gray500}
          solid
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 48,
    borderRadius: 14,
    fontSize: 16,
    color: colors.gray900,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
});
