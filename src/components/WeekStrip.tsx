import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Workout } from '../types';
import { DAY_MS, startOfWeek } from '../utils';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Mon–Sun dots, lit on days with a finished workout. */
export function WeekStrip({ history }: { history: Workout[] }) {
  const weekStart = startOfWeek(Date.now());
  const todayIdx = Math.floor((Date.now() - weekStart) / DAY_MS);
  const trained = new Set(
    history
      .filter(w => w.startedAt >= weekStart)
      .map(w => Math.floor((w.startedAt - weekStart) / DAY_MS)),
  );

  return (
    <View style={styles.row}>
      {DAYS.map((d, i) => {
        const on = trained.has(i);
        const today = i === todayIdx;
        return (
          <View key={i} style={styles.col}>
            <View
              style={[
                styles.dot,
                on && styles.dotOn,
                today && !on && styles.dotToday,
              ]}
            >
              {on ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={[styles.day, today && styles.dayToday]}>{d}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { alignItems: 'center', gap: spacing(1.5) },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { backgroundColor: colors.accent },
  dotToday: { borderWidth: 2, borderColor: colors.accent },
  check: { color: colors.onAccent, fontWeight: '900' },
  day: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  dayToday: { color: colors.accent },
});
