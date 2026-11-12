import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store';
import { colors, spacing, type } from '../theme';
import { Routine } from '../types';
import { formatDate, startOfWeek, uid } from '../utils';
import { PlanSetup } from './PlanSetup';
import { RoutineEditor } from './RoutineEditor';
import { Button, Card, Pill } from './ui';

/** The weekly plan on the home screen: one card per training day. */
export function PlanSection({ nextId }: { nextId?: string }) {
  const { state, dispatch, exerciseById } = useStore();
  const [setupOpen, setSetupOpen] = useState(false);
  const [editing, setEditing] = useState<{
    routine: Routine;
    isNew: boolean;
  }>();
  const weekStart = startOfWeek(Date.now());

  const lastDone = (id: string) =>
    state.history.find(w => w.routineId === id)?.startedAt;

  const addDay = () =>
    setEditing({
      isNew: true,
      routine: {
        id: uid(),
        name: `Day ${state.routines.length + 1}`,
        exercises: [],
      },
    });

  return (
    <View>
      <View style={styles.head}>
        <Text style={type.kicker}>Your plan</Text>
        {state.routines.length ? (
          <Pressable
            onPress={() => setSetupOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Change split</Text>
          </Pressable>
        ) : null}
      </View>

      {state.routines.length === 0 ? (
        <Card>
          <Text style={styles.title}>Plan your training week</Text>
          <Text style={styles.sub}>
            Pick 3–6 days a week and get a split like Push · Pull · Legs. Each
            day remembers your exercises, sets and weights so you can beat them
            next time.
          </Text>
          <Button
            title="Set up my plan"
            onPress={() => setSetupOpen(true)}
            style={styles.gapTop}
          />
        </Card>
      ) : (
        state.routines.map((r, i) => {
          const done = lastDone(r.id);
          const doneThisWeek = done !== undefined && done >= weekStart;
          const sets = r.exercises.reduce((n, e) => n + e.sets, 0);
          return (
            <Card
              key={r.id}
              style={r.id === nextId ? styles.nextCard : undefined}
            >
              <View style={styles.titleRow}>
                <Text style={styles.dayNum}>DAY {i + 1}</Text>
                {r.id === nextId ? <Pill text="NEXT UP" /> : null}
                {doneThisWeek ? <Pill tone="gold" text="✓ THIS WEEK" /> : null}
              </View>
              <Text style={styles.title}>{r.name}</Text>
              <Text style={styles.meta}>
                {r.exercises.length} exercises · {sets} sets
                {done ? ` · last ${formatDate(done)}` : ''}
              </Text>
              {r.exercises.length ? (
                <Text style={styles.exList} numberOfLines={2}>
                  {r.exercises
                    .map(e => exerciseById(e.exerciseId)?.name ?? 'Deleted')
                    .join(' · ')}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Button
                  title="Edit"
                  variant="secondary"
                  onPress={() => setEditing({ routine: r, isNew: false })}
                  style={styles.flex}
                />
                <Button
                  title="Start"
                  variant={r.id === nextId ? 'primary' : 'secondary'}
                  disabled={r.exercises.length === 0}
                  onPress={() => dispatch({ type: 'startRoutine', id: r.id })}
                  style={styles.flex}
                />
              </View>
            </Card>
          );
        })
      )}

      {state.routines.length ? (
        <Button title="+  Add a day" variant="ghost" onPress={addDay} />
      ) : null}

      <PlanSetup visible={setupOpen} onClose={() => setSetupOpen(false)} />
      {editing ? (
        <RoutineEditor
          routine={editing.routine}
          isNew={editing.isNew}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(2),
    marginBottom: spacing(2),
    paddingHorizontal: spacing(1),
  },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  nextCard: { borderColor: colors.accent, borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  dayNum: { ...type.kicker, marginRight: spacing(1) },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: spacing(1),
  },
  sub: { color: colors.muted, marginTop: spacing(1), lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3, fontWeight: '600' },
  exList: {
    color: colors.text,
    opacity: 0.8,
    fontSize: 13,
    marginTop: spacing(2),
  },
  actions: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(3) },
  gapTop: { marginTop: spacing(4) },
});
