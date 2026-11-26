import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LANGUAGE_NAMES, LANGUAGES, useI18n } from '../i18n';
import { colors, spacing, type } from '../theme';
import { Text } from './Text';

/**
 * English / العربية switch. Its label is written in both languages on purpose,
 * so it can still be found after switching to one you can't read.
 */
export function LanguageSwitcher() {
  const { lang, setLanguage } = useI18n();
  return (
    <View style={styles.wrap}>
      <Text style={type.kicker}>Language · اللغة</Text>
      <View style={styles.options}>
        {LANGUAGES.map(l => {
          const on = l === lang;
          return (
            <Pressable
              key={l}
              onPress={() => setLanguage(l)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.option, on && styles.optionOn]}
            >
              <Text style={[styles.optionText, on && styles.optionTextOn]}>
                {LANGUAGE_NAMES[l]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing(6), gap: spacing(2) },
  options: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing(1),
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(2.5),
    borderRadius: 10,
  },
  optionOn: { backgroundColor: colors.accent },
  optionText: { color: colors.muted, fontWeight: '700' },
  optionTextOn: { color: colors.onAccent, fontWeight: '800' },
});
