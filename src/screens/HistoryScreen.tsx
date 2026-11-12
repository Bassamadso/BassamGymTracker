import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseIcon } from '../components/ExerciseIcon';
import { Button, Card, Empty, Header, Pill, StatTile } from '../components/ui';
import { useStore } from '../store';
import { colors, spacing, type } from '../theme';
import { Workout } from '../types';
import {
  completedSets,
  formatDate,
  formatDuration,
  formatKg,
  prCounts,
  workoutVolume,
} from '../utils';

export function HistoryScreen() {
  const { state } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const total = useMemo(
    () => state.history.reduce((n, w) => n + workoutVolume(w), 0),
    [state.history],
  );
  const prs = useMemo(() => prCounts(state.history), [state.history]);

  return (
    <View style={styles.root}>
      <FlatList
        data={state.history}
        keyExtractor={w => w.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <Header kicker="Your journey" title="History" />
            {state.history.length ? (
              <View style={[styles.tiles, styles.pad]}>
                <StatTile
                  label="Workouts"
                  value={String(state.history.length)}
                />
                <StatTile label="Lifted" value={formatKg(total)} />
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <Empty
            title="Nothing logged yet"
            subtitle="Finish your first workout and it'll show up here with all its numbers."
          />
        }
        renderItem={({ item, index }) => (
          <Pressable onPress={() => setOpen(index)} style={styles.pad}>
            <WorkoutSummary workout={item} prs={prs[item.id] ?? 0} />
          </Pressable>
        )}
      />
      {open !== null && state.history[open] ? (
        <WorkoutDetail
          workout={state.history[open]}
          prs={prs[state.history[open].id] ?? 0}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </View>
  );
}

function WorkoutSummary({ workout, prs }: { workout: Workout; prs: number }) {
  const { exerciseById } = useStore();
  const d = new Date(workout.startedAt);
  return (
    <Card style={styles.summary}>
      <View style={styles.dateBlock}>
        <Text style={styles.dateDay}>{d.getDate()}</Text>
        <Text style={styles.dateMonth}>
          {d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
        </Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {workout.name}
          </Text>
          {prs > 0 ? <Pill tone="gold" text={`🏆 ${prs}`} /> : null}
        </View>
        <Text style={styles.meta}>
          {formatDuration(
            (workout.finishedAt ?? workout.startedAt) - workout.startedAt,
          )}
          {'  ·  '}
          {completedSets(workout)} sets{'  ·  '}
          {formatKg(workoutVolume(workout))}
        </Text>
        <Text style={styles.exList} numberOfLines={2}>
          {workout.exercises
            .map(e => exerciseById(e.exerciseId)?.name ?? 'Deleted')
            .join(' · ')}
        </Text>
      </View>
    </Card>
  );
}

function WorkoutDetail({
  workout,
  prs,
  onClose,
}: {
  workout: Workout;
  prs: number;
  onClose: () => void;
}) {
  const { dispatch, exerciseById } = useStore();

  const del = () =>
    Alert.alert('Delete workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onClose();
          dispatch({ type: 'deleteWorkout', id: workout.id });
        },
      },
    ]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <Header
          kicker={formatDate(workout.startedAt)}
          title={workout.name}
          right={<Button title="Close" variant="ghost" onPress={onClose} />}
        />
        <ScrollView contentContainerStyle={[styles.pad, styles.list]}>
          <View style={[styles.tiles, { marginBottom: spacing(4) }]}>
            <StatTile
              label="Time"
              value={formatDuration(
                (workout.finishedAt ?? workout.startedAt) - workout.startedAt,
              )}
            />
            <StatTile label="Volume" value={formatKg(workoutVolume(workout))} />
            <StatTile label="PRs" value={String(prs)} />
          </View>
          {workout.exercises.map(e => {
            const top = Math.max(...e.sets.map(s => parseFloat(s.weight) || 0));
            return (
              <Card key={e.id}>
                <View style={styles.exHead}>
                  <ExerciseIcon
                    exercise={exerciseById(e.exerciseId)}
                    size={40}
                  />
                  <Text style={[styles.exName, styles.flex]}>
                    {exerciseById(e.exerciseId)?.name ?? 'Deleted exercise'}
                  </Text>
                </View>
                {e.sets.map((s, i) => {
                  const isTop = (parseFloat(s.weight) || 0) === top && top > 0;
                  return (
                    <View key={s.id} style={styles.setRow}>
                      <Text style={styles.setNum}>{i + 1}</Text>
                      <Text style={[styles.setText, isTop && styles.setTop]}>
                        {s.weight || 0} kg × {s.reps || 0}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            );
          })}
          <Button title="Delete workout" variant="danger" onPress={del} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { paddingBottom: spacing(10) },
  exHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginBottom: spacing(1),
  },
  pad: { paddingHorizontal: spacing(4) },
  tiles: { flexDirection: 'row', gap: spacing(2.5), marginBottom: spacing(4) },
  summary: { flexDirection: 'row', gap: spacing(4), alignItems: 'center' },
  dateBlock: {
    width: 54,
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { color: colors.text, fontSize: 22, fontWeight: '900' },
  dateMonth: { ...type.kicker, fontSize: 10, color: colors.accent },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3, fontWeight: '600' },
  exList: {
    color: colors.text,
    opacity: 0.8,
    fontSize: 13,
    marginTop: spacing(2),
  },
  exName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing(2),
  },
  setRow: { flexDirection: 'row', paddingVertical: spacing(1.5) },
  setNum: { color: colors.muted, width: 28, fontWeight: '900' },
  setText: { color: colors.text, fontSize: 15, fontVariant: ['tabular-nums'] },
  setTop: { color: colors.accent, fontWeight: '800' },
});
