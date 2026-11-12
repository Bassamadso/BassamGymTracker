import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

/** Minimal bar chart drawn with Views; the latest bar is highlighted. */
export function BarChart({
  values,
  labels,
  height = 140,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  // Start the scale a bit below the lowest value so progress is visible
  const floor = values.length > 1 ? Math.max(0, min - (max - min) * 0.5) : 0;

  return (
    <View>
      <View style={[styles.bars, { height }]}>
        {values.map((v, i) => {
          const last = i === values.length - 1;
          const h = ((v - floor) / (max - floor || 1)) * (height - 22);
          return (
            <View key={i} style={styles.col}>
              <Text style={[styles.val, last && styles.valOn]}>
                {Math.round(v)}
              </Text>
              <View
                style={[
                  styles.bar,
                  { height: Math.max(6, h) },
                  last && styles.barOn,
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {labels.map((l, i) => (
          <Text key={i} style={styles.label} numberOfLines={1}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing(1.5) },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, backgroundColor: colors.cardAlt },
  barOn: { backgroundColor: colors.accent },
  val: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
  },
  valOn: { color: colors.accent },
  labels: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(1.5) },
  label: { flex: 1, color: colors.muted, fontSize: 9, textAlign: 'center' },
});
