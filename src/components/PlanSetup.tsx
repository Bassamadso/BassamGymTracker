import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildPlan, SPLITS } from '../plans';
import { useStore } from '../store';
import { colors, spacing, type } from '../theme';
import { Button, Card, Header } from './ui';

const DAY_OPTIONS = [3, 4, 5, 6];

/** Lets the user pick how many days a week they train and a starting split. */
export function PlanSetup({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { state, dispatch, exerciseById } = useStore();
  const [days, setDays] = useState(3);
  const [custom, setCustom] = useState(false);
  const split = SPLITS.find(s => s.days === days)!;
  const preview = useMemo(
    () => buildPlan(custom ? { days } : split, state.exercises),
    [custom, days, split, state.exercises],
  );

  const apply = () => {
    const save = () => {
      dispatch({ type: 'setPlan', routines: preview });
      onClose();
    };
    if (state.routines.length) {
      Alert.alert(
        'Replace your plan?',
        'Your current training days will be replaced. Logged workouts are kept.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: save },
        ],
      );
    } else {
      save();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <Header
          kicker="Weekly plan"
          title="Your split"
          right={<Button title="Cancel" variant="ghost" onPress={onClose} />}
        />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.question}>
            How many days a week do you train?
          </Text>
          <View style={styles.days}>
            {DAY_OPTIONS.map(d => (
              <Pressable
                key={d}
                onPress={() => setDays(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: d === days }}
                accessibilityLabel={`${d} days per week`}
                style={[styles.day, d === days && styles.dayOn]}
              >
                <Text style={[styles.dayNum, d === days && styles.dayTextOn]}>
                  {d}
                </Text>
                <Text style={[styles.dayLabel, d === days && styles.dayTextOn]}>
                  days
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.modes}>
            <Pressable
              onPress={() => setCustom(false)}
              style={[styles.mode, !custom && styles.modeOn]}
            >
              <Text style={[styles.modeText, !custom && styles.modeTextOn]}>
                Recommended
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCustom(true)}
              style={[styles.mode, custom && styles.modeOn]}
            >
              <Text style={[styles.modeText, custom && styles.modeTextOn]}>
                Build my own
              </Text>
            </Pressable>
          </View>

          {custom ? (
            <Text style={styles.desc}>
              {days} empty days. Name them and add your own exercises after.
            </Text>
          ) : (
            <>
              <Text style={styles.splitTitle}>{split.title}</Text>
              <Text style={styles.desc}>{split.description}</Text>
            </>
          )}

          {preview.map((r, i) => (
            <Card key={r.id}>
              <Text style={type.kicker}>Day {i + 1}</Text>
              <Text style={styles.routineName}>{r.name}</Text>
              {r.exercises.length ? (
                r.exercises.map(e => (
                  <Text key={e.id} style={styles.exLine}>
                    {exerciseById(e.exerciseId)?.name}
                    <Text style={styles.muted}>
                      {'  '}
                      {e.sets} × {e.reps}
                    </Text>
                  </Text>
                ))
              ) : (
                <Text style={styles.muted}>No exercises yet</Text>
              )}
            </Card>
          ))}

          <Button big title="USE THIS PLAN" onPress={apply} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: spacing(4), paddingBottom: spacing(10) },
  question: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  days: { flexDirection: 'row', gap: spacing(2.5), marginBottom: spacing(4) },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(3),
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dayOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayNum: { color: colors.text, fontSize: 24, fontWeight: '900' },
  dayLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  dayTextOn: { color: colors.onAccent },
  modes: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing(1),
    marginBottom: spacing(4),
  },
  mode: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(2.5),
    borderRadius: 10,
  },
  modeOn: { backgroundColor: colors.cardAlt },
  modeText: { color: colors.muted, fontWeight: '700' },
  modeTextOn: { color: colors.text },
  splitTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  desc: {
    color: colors.muted,
    marginTop: spacing(1),
    marginBottom: spacing(4),
    lineHeight: 20,
  },
  routineName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing(1),
    marginBottom: spacing(2),
  },
  exLine: { color: colors.text, fontSize: 14, paddingVertical: 2 },
  muted: { color: colors.muted },
});
