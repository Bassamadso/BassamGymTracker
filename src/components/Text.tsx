import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { useI18n } from '../i18n';

// Letter-spacing (positive or negative) pulls Arabic's joined letters apart,
// so it's switched off whenever the UI is in Arabic. Use this component, not
// react-native's Text, so that happens everywhere without per-style checks.
const noTracking = { letterSpacing: 0 } as const;

export function Text({ style, ...props }: TextProps) {
  const { lang } = useI18n();
  return (
    <RNText {...props} style={lang === 'ar' ? [style, noTracking] : style} />
  );
}
