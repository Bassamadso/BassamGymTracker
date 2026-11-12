import React, { useEffect, useState } from 'react';
import {
  Alert,
  Vibration,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ExerciseIcon } from '../components/ExerciseIcon';
import { ExercisePicker } from '../components/ExercisePicker';
import { PlanSection } from '../components/PlanSection';
import { ReorderList } from '../components/ReorderList';
import { Button, Card, Header, Pill, StatTile } from '../components/ui';
import { WeekStrip } from '../components/WeekStrip';
import { bottomOfRange, nextRoutine, topOfRange } from '../plans';
import { bestWeightFor, lastSetsFor, useStore } from '../store';
import { colors, spacing, type } from '../theme';
import { WorkoutExercise, WorkoutSet } from '../types';
import {
  completedSets,
  formatDate,
  formatKg,
  formatTimer,
  greeting,
  sanitizeWeight,
  startOfWeek,
  workoutVolume,
} from '../utils';

export function WorkoutScreen() {
  const { state } = useStore();
  return state.active ? <ActiveWorkout /> : <Home />;
}

/* ───────────────────────── Home dashboard ───────────────────────── */

function Home() {
  const { state, dispatch, exerciseById } = useStore();
  const weekStart = startOfWeek(Date.now());
  const thisWeek = state.history.filter(w => w.startedAt >= weekStart);
  const weekVolume = thisWeek.reduce((n, w) => n + workoutVolume(w), 0);
  const weekSets = thisWeek.reduce((n, w) => n + completedSets(w), 0);
  const last = state.history[0];
  const next = nextRoutine(state.routines, state.history);
  const hasPlan = state.routines.length > 0;

  const repeat = () => {
    if (!last) return;
    dispatch({ type: 'startWorkout' });
    dispatch({
      type: 'addToWorkout',
      exerciseIds: last.exercises.map(e => e.exerciseId),
    });
    dispatch({ type: 'renameWorkout', name: last.name });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Header kicker={greeting()} title="Ready to lift?" />
      <View style={styles.pad}>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={type.kicker}>This week</Text>
            <Text style={styles.weekCount}>
              {thisWeek.length}
              <Text style={styles.muted}>
                {hasPlan ? ` / ${state.routines.length}` : ''} workouts
              </Text>
            </Text>
          </View>
          <View style={{ marginTop: spacing(4) }}>
            <WeekStrip history={state.history} />
          </View>
        </Card>

        <View style={styles.tiles}>
          <StatTile label="Volume" value={formatKg(weekVolume)} />
          <StatTile label="Sets" value={String(weekSets)} />
          <StatTile label="All time" value={String(state.history.length)} />
        </View>

        {next ? (
          <>
            <Button
              big
              title={`START ${next.name.toUpperCase()}`}
              onPress={() => dispatch({ type: 'startRoutine', id: next.id })}
              style={{ marginTop: spacing(4) }}
            />
            <Button
              title="or start an empty workout"
              variant="ghost"
              onPress={() => dispatch({ type: 'startWorkout' })}
              style={{ marginBottom: spacing(2) }}
            />
          </>
        ) : (
          <Button
            big
            title="START WORKOUT"
            onPress={() => dispatch({ type: 'startWorkout' })}
            style={{ marginVertical: spacing(4) }}
          />
        )}

        <PlanSection nextId={next?.id} />

        {!hasPlan && last ? (
          <Card>
            <Text style={type.kicker}>
              Last session · {formatDate(last.startedAt)}
            </Text>
            <Text style={styles.lastName}>{last.name}</Text>
            <View style={styles.chips}>
              {last.exercises.map(e => (
                <View key={e.id} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {exerciseById(e.exerciseId)?.name ?? 'Deleted'}
                  </Text>
                </View>
              ))}
            </View>
            <Button
              title="↻  Repeat this workout"
              variant="secondary"
              onPress={repeat}
            />
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}

/* ───────────────────────── Active workout ───────────────────────── */

function ActiveWorkout() {
  const { state, dispatch, exerciseById } = useStore();
  const active = state.active!;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startRest = () => dispatch({ type: 'startRest' });
  // A day from the plan keeps its name; only ad-hoc workouts can be renamed
  const fromPlan = !!active.routineId;
  const canReorder = active.exercises.length > 1;
  const showReorder = reordering && canReorder;

  const finish = () => {
    const done = completedSets(active);
    if (done === 0) {
      Alert.alert(
        'No completed sets',
        'Tick off at least one set before finishing, or discard this workout.',
      );
      return;
    }
    const total = active.exercises.reduce((n, e) => n + e.sets.length, 0);
    const skipped = total - done;
    Alert.alert(
      'Finish workout?',
      `${done} sets · ${formatKg(workoutVolume(active))} moved. Nice work.` +
        (skipped > 0
          ? `\n\n${skipped} unticked set${
              skipped > 1 ? 's' : ''
            } won't be saved.`
          : ''),
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Finish', onPress: () => dispatch({ type: 'finishWorkout' }) },
      ],
    );
  };

  const discard = () =>
    Alert.alert('Discard workout?', 'All logged sets will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => dispatch({ type: 'discardWorkout' }),
      },
    ]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.activeTop}>
        <View style={styles.flex}>
          <Text style={[type.kicker, { color: colors.accent }]}>● Live</Text>
          {fromPlan ? (
            <Text
              style={styles.workoutName}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {active.name}
            </Text>
          ) : (
            <TextInput
              value={active.name}
              onChangeText={name => dispatch({ type: 'renameWorkout', name })}
              style={styles.workoutName}
              accessibilityLabel="Workout name"
              returnKeyType="done"
            />
          )}
        </View>
        <Button title="Finish" onPress={finish} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.pad, { paddingBottom: spacing(40) }]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!(dragging && showReorder)}
      >
        <View style={styles.tiles}>
          <Clock startedAt={active.startedAt} />
          <StatTile label="Sets" value={String(completedSets(active))} />
          <StatTile label="Volume" value={formatKg(workoutVolume(active))} />
        </View>

        <RestSetting />

        {canReorder ? (
          <View style={styles.listHead}>
            <Text style={[type.kicker, styles.flex]}>
              {showReorder ? 'Drag ≡ to set your order' : 'Exercises'}
            </Text>
            <Button
              title={showReorder ? 'Done' : '⇅  Reorder'}
              variant={showReorder ? 'primary' : 'secondary'}
              onPress={() => setReordering(r => !r)}
              style={styles.reorderBtn}
            />
          </View>
        ) : null}

        {showReorder ? (
          <ReorderList
            items={active.exercises.map(we => {
              const ex = exerciseById(we.exerciseId);
              const done = we.sets.filter(s => s.done).length;
              return {
                id: we.id,
                title: ex?.name ?? 'Deleted exercise',
                subtitle: `${ex?.muscle ?? ''}${ex ? ' · ' : ''}${done}/${
                  we.sets.length
                } sets done`,
              };
            })}
            onReorder={ids =>
              dispatch({ type: 'reorderWorkout', workoutExerciseIds: ids })
            }
            onDragChange={setDragging}
          />
        ) : (
          active.exercises.map(we => (
            <ExerciseBlock key={we.id} we={we} onSetDone={startRest} />
          ))
        )}

        <Button
          title="+  Add exercises"
          variant="secondary"
          onPress={() => setPickerOpen(true)}
          style={styles.addBtn}
        />
        <Button title="Discard workout" variant="ghost" onPress={discard} />
      </ScrollView>

      <ExercisePicker
        visible={pickerOpen}
        existingIds={active.exercises.map(e => e.exerciseId)}
        onClose={() => setPickerOpen(false)}
        onPick={ids => dispatch({ type: 'addToWorkout', exerciseIds: ids })}
      />
    </KeyboardAvoidingView>
  );
}

function RestSetting() {
  const { state, dispatch } = useStore();
  const change = (d: number) =>
    dispatch({ type: 'setRestSeconds', seconds: state.restSeconds + d });
  return (
    <View style={styles.restSetting}>
      <Text style={styles.muted}>Rest between sets</Text>
      <View style={styles.restCtrls}>
        <Pressable
          onPress={() => change(-15)}
          style={styles.restBtn}
          hitSlop={6}
        >
          <Text style={styles.restBtnText}>−</Text>
        </Pressable>
        <Text style={styles.restValue}>
          {formatTimer(state.restSeconds * 1000)}
        </Text>
        <Pressable
          onPress={() => change(15)}
          style={styles.restBtn}
          hitSlop={6}
        >
          <Text style={styles.restBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ExerciseBlock({
  we,
  onSetDone,
}: {
  we: WorkoutExercise;
  onSetDone: () => void;
}) {
  const { state, dispatch, exerciseById } = useStore();
  const exercise = exerciseById(we.exerciseId);
  const previous = lastSetsFor(state.history, we.exerciseId);
  const best = bestWeightFor(state.history, we.exerciseId);
  const doneCount = we.sets.filter(s => s.done).length;
  // Progressive overload: hit the top of the rep range on every set → go heavier
  const target = we.targetReps ? topOfRange(we.targetReps) : 0;
  const lastTop = Math.max(0, ...previous.map(p => parseFloat(p.weight) || 0));
  const readyToProgress =
    target > 0 &&
    previous.length > 0 &&
    lastTop > 0 &&
    previous.every(p => (parseInt(p.reps, 10) || 0) >= target);
  const fallbackReps = we.targetReps
    ? String(bottomOfRange(we.targetReps) || '')
    : '';

  const remove = () =>
    Alert.alert('Remove exercise?', exercise?.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          dispatch({ type: 'removeFromWorkout', workoutExerciseId: we.id }),
      },
    ]);

  return (
    <Card>
      <View style={styles.exHeader}>
        <ExerciseIcon exercise={exercise} size={48} />
        <View style={styles.flex}>
          <Text style={styles.exName}>
            {exercise?.name ?? 'Deleted exercise'}
          </Text>
          <Text style={styles.exMeta}>
            {exercise?.muscle ?? ''}
            {we.targetReps
              ? ` · Target ${we.sets.length} × ${we.targetReps}`
              : ''}
            {best > 0 ? ` · Best ${best} kg` : ''}
          </Text>
        </View>
        <Text style={styles.exProgress}>
          {doneCount}/{we.sets.length}
        </Text>
        <Pressable
          onPress={remove}
          hitSlop={10}
          style={styles.removeBtn}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise?.name ?? 'exercise'}`}
        >
          <Text style={styles.removeText}>✕</Text>
        </Pressable>
      </View>

      {readyToProgress ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            ↑ You hit {target} reps on every set last time. Try {lastTop + 2.5}{' '}
            kg today.
          </Text>
        </View>
      ) : null}

      <View style={styles.setRow}>
        <Text style={[styles.colSet, styles.colHead]}>SET</Text>
        <Text style={[styles.colPrev, styles.colHead]}>PREVIOUS</Text>
        <Text style={[styles.colInput, styles.colHead]}>KG</Text>
        <Text style={[styles.colInput, styles.colHead]}>REPS</Text>
        <View style={styles.colCheck} />
      </View>

      {we.sets.map((s, i) => (
        <SetRow
          key={s.id}
          index={i}
          set={s}
          prev={previous[i]}
          fallbackReps={fallbackReps}
          isPR={s.done && best > 0 && (parseFloat(s.weight) || 0) > best}
          onUpdate={patch =>
            dispatch({
              type: 'updateSet',
              workoutExerciseId: we.id,
              setId: s.id,
              patch,
            })
          }
          onRemove={() =>
            dispatch({
              type: 'removeSet',
              workoutExerciseId: we.id,
              setId: s.id,
            })
          }
          onDone={onSetDone}
        />
      ))}

      <Pressable
        onPress={() => dispatch({ type: 'addSet', workoutExerciseId: we.id })}
        style={styles.addSet}
        accessibilityRole="button"
        accessibilityLabel={`Add set to ${exercise?.name ?? 'exercise'}`}
      >
        <Text style={styles.addSetText}>+ Add set</Text>
      </Pressable>
    </Card>
  );
}

function SetRow({
  index,
  set: s,
  prev,
  fallbackReps,
  isPR,
  onUpdate,
  onRemove,
  onDone,
}: {
  index: number;
  set: WorkoutSet;
  prev?: WorkoutSet;
  fallbackReps: string;
  isPR: boolean;
  onUpdate: (patch: Partial<WorkoutSet>) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const weightHint = prev?.weight || '';
  const repsHint = prev?.reps || fallbackReps;
  const toggle = () => {
    if (s.done) {
      onUpdate({ done: false });
      return;
    }
    // Ticking an empty set logs what's shown as the placeholder
    const weight = s.weight || weightHint;
    const reps = s.reps || repsHint;
    if (!(parseInt(reps, 10) > 0)) {
      Alert.alert('How many reps?', 'Enter your reps before ticking the set.');
      return;
    }
    Vibration.vibrate(15);
    onDone();
    onUpdate({ done: true, weight, reps });
  };
  const confirmRemove = () =>
    Alert.alert(`Remove set ${index + 1}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
  return (
    <View>
      <View style={[styles.setRow, s.done && styles.setDone]}>
        <Pressable
          style={styles.colSet}
          onPress={confirmRemove}
          accessibilityRole="button"
          accessibilityLabel={`Set ${index + 1}. Tap to remove`}
        >
          <Text style={[styles.setNum, s.done && styles.setNumDone]}>
            {index + 1}
          </Text>
        </Pressable>
        <Pressable
          style={styles.colPrev}
          disabled={!prev}
          onPress={() =>
            prev && onUpdate({ weight: prev.weight, reps: prev.reps })
          }
          accessibilityRole="button"
          accessibilityLabel={
            prev
              ? `Use previous: ${prev.weight} kg, ${prev.reps} reps`
              : 'No previous set'
          }
        >
          <Text style={styles.prev}>
            {prev ? `${prev.weight || 0} × ${prev.reps || 0}` : '—'}
          </Text>
        </Pressable>
        <TextInput
          style={[styles.colInput, styles.input, s.done && styles.inputDone]}
          value={s.weight}
          onChangeText={t => onUpdate({ weight: sanitizeWeight(t) })}
          keyboardType="decimal-pad"
          placeholder={weightHint || '0'}
          accessibilityLabel={`Set ${index + 1} weight in kilograms`}
          placeholderTextColor={colors.muted}
          selectTextOnFocus
        />
        <TextInput
          style={[styles.colInput, styles.input, s.done && styles.inputDone]}
          value={s.reps}
          onChangeText={t => onUpdate({ reps: t.replace(/\D/g, '') })}
          keyboardType="number-pad"
          placeholder={repsHint || '0'}
          accessibilityLabel={`Set ${index + 1} reps`}
          placeholderTextColor={colors.muted}
          selectTextOnFocus
        />
        <Pressable
          onPress={toggle}
          style={[styles.colCheck, styles.check, s.done && styles.checkOn]}
          hitSlop={6}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: s.done }}
          accessibilityLabel={`Complete set ${index + 1}`}
        >
          <Text style={[styles.checkMark, s.done && styles.checkMarkOn]}>
            ✓
          </Text>
        </Pressable>
      </View>
      {isPR ? (
        <View style={styles.prRow}>
          <Pill tone="gold" text="🏆 NEW PERSONAL RECORD" />
        </View>
      ) : null}
    </View>
  );
}

function Clock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <StatTile label="Time" value={formatTimer(now - startedAt)} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing(10) },
  pad: { paddingHorizontal: spacing(4) },
  muted: { color: colors.muted, fontSize: 14 },
  intro: { marginTop: spacing(1), lineHeight: 20 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekCount: { color: colors.text, fontSize: 20, fontWeight: '900' },
  tiles: { flexDirection: 'row', gap: spacing(2.5) },
  lastName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: spacing(1),
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginVertical: spacing(3),
  },
  chip: {
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },

  activeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingTop: spacing(4),
    paddingBottom: spacing(3),
    gap: spacing(3),
  },
  workoutName: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    padding: 0,
    letterSpacing: -0.5,
  },
  restSetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing(3),
    paddingHorizontal: spacing(1),
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing(3),
    paddingHorizontal: spacing(1),
  },
  reorderBtn: { paddingVertical: spacing(2), paddingHorizontal: spacing(3) },
  restCtrls: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  restBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restBtnText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  restValue: {
    color: colors.text,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'center',
  },

  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing(3),
    gap: spacing(3),
  },
  exName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  exMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  exProgress: {
    color: colors.accent,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.muted, fontSize: 12, fontWeight: '800' },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(1),
    borderRadius: 12,
  },
  setDone: { backgroundColor: colors.successSoft },
  colHead: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  colSet: { width: 28, alignItems: 'center' },
  colPrev: { flex: 1 },
  colInput: { width: 62, textAlign: 'center' },
  colCheck: { width: 44, height: 44 },
  setNum: { color: colors.muted, fontWeight: '900', fontSize: 15 },
  setNumDone: { color: colors.accent },
  prev: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 10,
    paddingVertical: spacing(2),
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  inputDone: { backgroundColor: 'transparent' },
  check: {
    borderRadius: 10,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent },
  checkMark: { color: colors.muted, fontWeight: '900', fontSize: 16 },
  checkMarkOn: { color: colors.onAccent },
  prRow: { paddingLeft: spacing(9), paddingBottom: spacing(1) },
  hint: {
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    padding: spacing(2.5),
    marginBottom: spacing(3),
  },
  hintText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  addSet: {
    marginTop: spacing(2),
    paddingVertical: spacing(2.5),
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
  },
  addSetText: { color: colors.muted, fontWeight: '700' },
  addBtn: { marginTop: spacing(1), marginBottom: spacing(2) },
});
