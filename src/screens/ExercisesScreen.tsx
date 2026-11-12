import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from '../components/BarChart';
import { ExerciseForm } from '../components/ExerciseForm';
import { ExerciseIcon } from '../components/ExerciseIcon';
import { Button, Card, Empty, Header, StatTile } from '../components/ui';
import { useStore } from '../store';
import { colors, spacing, type } from '../theme';
import { Exercise, MUSCLE_GROUPS, Workout } from '../types';
import { e1rm, formatDate } from '../utils';

interface Session {
  date: number;
  top: number; // heaviest weight that day
  e1rm: number;
  sets: { weight: string; reps: string }[];
}

/** Every session of an exercise, oldest first. */
function sessionsFor(history: Workout[], exerciseId: string): Session[] {
  const out: Session[] = [];
  for (const w of history) {
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      let top = 0;
      let best1rm = 0;
      for (const s of e.sets) {
        const wt = parseFloat(s.weight) || 0;
        top = Math.max(top, wt);
        best1rm = Math.max(best1rm, e1rm(wt, parseInt(s.reps, 10) || 0));
      }
      out.push({ date: w.startedAt, top, e1rm: best1rm, sets: e.sets });
    }
  }
  return out.reverse();
}

export function ExercisesScreen() {
  const { state, dispatch } = useStore();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Exercise | null>(null);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MUSCLE_GROUPS.map(m => ({
      title: m,
      data: state.exercises
        .filter(
          e =>
            !e.archived && e.muscle === m && e.name.toLowerCase().includes(q),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter(s => s.data.length > 0);
  }, [state.exercises, query]);

  const summary = useMemo(() => {
    const map: Record<string, { top: number; sessions: number }> = {};
    for (const w of state.history) {
      for (const e of w.exercises) {
        const entry = (map[e.exerciseId] ??= { top: 0, sessions: 0 });
        entry.sessions++;
        for (const s of e.sets) {
          entry.top = Math.max(entry.top, parseFloat(s.weight) || 0);
        }
      }
    }
    return map;
  }, [state.history]);

  const confirmDelete = (e: Exercise) =>
    Alert.alert(
      'Delete exercise?',
      `"${e.name}" will be removed from your library. Past workouts keep their logged sets.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => dispatch({ type: 'deleteExercise', id: e.id }),
        },
      ],
    );

  return (
    <View style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={e => e.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            <Header
              kicker={`${
                state.exercises.filter(e => !e.archived).length
              } movements`}
              title="Library"
              right={
                !creating ? (
                  <Button
                    title="+ New"
                    variant="secondary"
                    onPress={() => setCreating(true)}
                  />
                ) : undefined
              }
            />
            <View style={styles.pad}>
              {creating ? (
                <ExerciseForm
                  onCancel={() => setCreating(false)}
                  onCreated={() => setCreating(false)}
                />
              ) : null}
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search exercises"
                placeholderTextColor={colors.muted}
                style={styles.search}
              />
            </View>
          </>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[type.kicker, styles.section]}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const s = summary[item.id];
          return (
            <Pressable
              onPress={() => setOpen(item)}
              onLongPress={() => confirmDelete(item)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <ExerciseIcon exercise={item} size={52} />
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {s
                    ? `${s.sessions} session${s.sessions > 1 ? 's' : ''}`
                    : 'Not logged yet'}
                </Text>
              </View>
              {s && s.top > 0 ? (
                <View style={styles.best}>
                  <Text style={styles.bestValue}>{s.top}</Text>
                  <Text style={styles.bestUnit}>KG BEST</Text>
                </View>
              ) : null}
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Text style={styles.hint}>
            Tap for progress · long-press to delete
          </Text>
        }
      />
      {open ? (
        <ExerciseDetail exercise={open} onClose={() => setOpen(null)} />
      ) : null}
    </View>
  );
}

function ExerciseDetail({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const { state } = useStore();
  const sessions = useMemo(
    () => sessionsFor(state.history, exercise.id),
    [state.history, exercise.id],
  );
  const recent = sessions.slice(-10);
  const best = Math.max(0, ...sessions.map(s => s.top));
  const best1rm = Math.max(0, ...sessions.map(s => s.e1rm));
  const first = sessions[0]?.top ?? 0;
  const gain = best - first;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <Header
          kicker={exercise.muscle}
          title={exercise.name}
          right={<Button title="Close" variant="ghost" onPress={onClose} />}
        />
        <ScrollView contentContainerStyle={[styles.pad, styles.list]}>
          <View style={styles.hero}>
            <ExerciseIcon exercise={exercise} size={140} />
          </View>
          {sessions.length === 0 ? (
            <Empty
              title="No data yet"
              subtitle="Log this exercise in a workout and your progress chart will appear here."
            />
          ) : (
            <>
              <View style={styles.tiles}>
                <StatTile label="Best" value={`${best}`} unit="kg" />
                <StatTile
                  label="Est. 1RM"
                  value={`${Math.round(best1rm)}`}
                  unit="kg"
                />
                <StatTile
                  label="Progress"
                  value={`${gain >= 0 ? '+' : ''}${gain}`}
                  unit="kg"
                />
              </View>
              <Card>
                <Text style={[type.kicker, { marginBottom: spacing(4) }]}>
                  Top weight per session
                </Text>
                <BarChart
                  values={recent.map(s => s.top)}
                  labels={recent.map(s =>
                    new Date(s.date).toLocaleDateString(undefined, {
                      month: 'numeric',
                      day: 'numeric',
                    }),
                  )}
                />
              </Card>
              <Text style={[type.kicker, styles.section]}>Recent sessions</Text>
              {[...sessions]
                .reverse()
                .slice(0, 8)
                .map((s, i) => (
                  <Card key={i}>
                    <View style={styles.sessionHead}>
                      <Text style={styles.name}>{formatDate(s.date)}</Text>
                      <Text style={styles.meta}>top {s.top} kg</Text>
                    </View>
                    <Text style={styles.sessionSets}>
                      {s.sets
                        .map(x => `${x.weight || 0}×${x.reps || 0}`)
                        .join('   ')}
                    </Text>
                  </Card>
                ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { paddingBottom: spacing(10) },
  pad: { paddingHorizontal: spacing(4) },
  search: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 14,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  section: {
    marginTop: spacing(5),
    marginBottom: spacing(2),
    paddingHorizontal: spacing(5),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing(4),
    marginBottom: spacing(2),
    marginHorizontal: spacing(4),
  },
  pressed: { opacity: 0.7 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  best: { alignItems: 'flex-end' },
  bestValue: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  bestUnit: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  chev: { color: colors.muted, fontSize: 22 },
  hint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing(4),
  },
  hero: { alignItems: 'center', marginBottom: spacing(4) },
  tiles: { flexDirection: 'row', gap: spacing(2.5), marginBottom: spacing(3) },
  sessionHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sessionSets: {
    color: colors.text,
    marginTop: spacing(2),
    fontVariant: ['tabular-nums'],
    opacity: 0.85,
  },
});
