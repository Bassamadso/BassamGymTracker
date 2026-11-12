import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { colors, spacing } from '../theme';
import { formatTimer } from '../utils';

/** Floating countdown shown between sets. Vibrates when time is up. */
export function RestTimer({
  endsAt,
  total,
  onChange,
  onDone,
}: {
  endsAt: number;
  total: number;
  onChange: (endsAt: number) => void;
  onDone: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const left = endsAt - now;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left <= 0) {
      // Don't buzz for a timer that ran out long ago (e.g. app was closed)
      if (left > -5000) Vibration.vibrate([0, 250, 120, 250]);
      onDone();
    }
  }, [left, onDone]);

  const progress = Math.max(0, Math.min(1, left / (total * 1000)));

  return (
    <View style={styles.wrap}>
      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      <View style={styles.row}>
        <Pressable style={styles.adj} onPress={() => onChange(endsAt - 15000)}>
          <Text style={styles.adjText}>−15</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.label}>REST</Text>
          <Text style={styles.time}>{formatTimer(left + 999)}</Text>
        </View>
        <Pressable style={styles.adj} onPress={() => onChange(endsAt + 15000)}>
          <Text style={styles.adjText}>+15</Text>
        </Pressable>
        <Pressable style={styles.skip} onPress={onDone}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing(4),
    right: spacing(4),
    bottom: spacing(3),
    backgroundColor: colors.cardAlt,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.accentSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing(2.5),
    gap: spacing(2),
  },
  center: { flex: 1, alignItems: 'center' },
  label: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  time: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  adj: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
  },
  adjText: { color: colors.text, fontWeight: '800' },
  skip: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3.5),
  },
  skipText: { color: colors.onAccent, fontWeight: '900' },
});
