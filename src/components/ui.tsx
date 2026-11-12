import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, spacing, type } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  style,
  disabled,
  big,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  style?: ViewStyle;
  disabled?: boolean;
  big?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        big && styles.big,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          big && styles.bigText,
          variant === 'primary' && styles.primaryText,
          variant === 'ghost' && styles.ghostText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Header({
  kicker,
  title,
  right,
}: {
  kicker?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        {kicker ? <Text style={type.kicker}>{kicker}</Text> : null}
        <Text style={type.display} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

export function StatTile({
  label,
  value,
  unit,
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.tile, style]}>
      <Text style={type.kicker}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export function Pill({
  text,
  tone = 'accent',
}: {
  text: string;
  tone?: 'accent' | 'gold';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'gold' ? styles.pillGold : styles.pillAccent,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: tone === 'gold' ? colors.gold : colors.accent },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

export function Empty({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  btn: {
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: { paddingVertical: spacing(5), borderRadius: 20 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.cardAlt },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  bigText: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  primaryText: { color: colors.onAccent },
  ghostText: { color: colors.accent },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing(4),
    marginBottom: spacing(3),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(5),
    paddingTop: spacing(4),
    paddingBottom: spacing(3),
    gap: spacing(3),
  },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing(3),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tileValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: spacing(1),
    fontVariant: ['tabular-nums'],
  },
  tileUnit: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  pill: {
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  pillAccent: { backgroundColor: colors.accentSoft },
  pillGold: { backgroundColor: colors.goldSoft },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingVertical: spacing(14) },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptySub: {
    color: colors.muted,
    marginTop: spacing(2),
    textAlign: 'center',
    paddingHorizontal: spacing(8),
    lineHeight: 20,
  },
});
