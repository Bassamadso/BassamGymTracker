import React, { useEffect, useState } from 'react';
import {
  Alert,
  Vibration,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ExerciseIcon } from '../components/ExerciseIcon';
import { ExercisePicker } from '../components/ExercisePicker';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { PlanSection } from '../components/PlanSection';
import { ReorderList } from '../components/ReorderList';
import { Text } from '../components/Text';
import { Button, Card, Header, Pill, StatTile } from '../components/ui';
import { WeekStrip } from '../components/WeekStrip';
import { useI18n } from '../i18n';
import { bottomOfRange, nextRoutine, topOfRange } from '../plans';
import { bestWeightFor, lastSetsFor, useStore } from '../store';
import { colors, spacing, type } from '../theme';
import { WorkoutExercise, WorkoutSet } from '../types';
import {
  completedSets,
  formatTimer,
  sanitizeReps,
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
  const { t, exerciseName, formatDate, formatKg, greeting, workoutName } =
    useI18n();
  const weekStart = startOfWeek(Date.now());
  const thisWeek = state.history.filter(w => w.startedAt >= weekStart);
  const weekVolume = thisWeek.reduce((n, w) => n + workoutVolume(w), 0);
  const weekSets = thisWeek.reduce((n, w) => n + completedSets(w), 0);
  const last = state.history[0];
  const next = nextRoutine(state.routines, state.history);
  const hasPlan = state.routines.length > 0;
  const nameOf = (id: string) => {
    const ex = exerciseById(id);
    return ex ? exerciseName(ex) : t('workout.deleted');
  };

  const repeat = () => {
    if (!last) return;
    dispatch({ type: 'startWorkout', name: last.name });
    dispatch({
      type: 'addToWorkout',
      exerciseIds: last.exercises.map(e => e.exerciseId),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Header kicker={greeting()} title={t('home.title')} />
      <View style={styles.pad}>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={type.kicker}>{t('home.thisWeek')}</Text>
            <Text style={styles.weekCount}>
              {thisWeek.length}
              <Text style={styles.muted}>
                {hasPlan ? ` / ${state.routines.length}` : ''}{' '}
                {t('home.workouts')}
              </Text>
            </Text>
          </View>
          <View style={{ marginTop: spacing(4) }}>
            <WeekStrip history={state.history} />
          </View>
        </Card>

        <View style={styles.tiles}>
          <StatTile label={t('home.volume')} value={formatKg(weekVolume)} />
          <StatTile label={t('home.sets')} value={String(weekSets)} />
          <StatTile
            label={t('home.allTime')}
            value={String(state.history.length)}
          />
        </View>

        {next ? (
          <>
            <Button
              big
              title={t('home.startDay', { name: next.name.toUpperCase() })}
              onPress={() => dispatch({ type: 'startRoutine', id: next.id })}
              style={{ marginTop: spacing(4) }}
            />
            <Button
              title={t('home.startEmpty')}
              variant="ghost"
              onPress={() =>
                dispatch({ type: 'startWorkout', name: workoutName() })
              }
              style={{ marginBottom: spacing(2) }}
            />
          </>
        ) : (
          <Button
            big
            title={t('home.startWorkout')}
            onPress={() =>
              dispatch({ type: 'startWorkout', name: workoutName() })
            }
            style={{ marginVertical: spacing(4) }}
          />
        )}

        <PlanSection nextId={next?.id} />

        {!hasPlan && last ? (
          <Card>
            <Text style={type.kicker}>
              {t('home.lastSession', { date: formatDate(last.startedAt) })}
            </Text>
            <Text style={styles.lastName}>{last.name}</Text>
            <View style={styles.chips}>
              {last.exercises.map(e => (
                <View key={e.id} style={styles.chip}>
                  <Text style={styles.chipText}>{nameOf(e.exerciseId)}</Text>
                </View>
              ))}
            </View>
            <Button
              title={t('home.repeat')}
              variant="secondary"
              onPress={repeat}
            />
          </Card>
        ) : null}

        <LanguageSwitcher />
      </View>
    </ScrollView>
  );
}

/* ───────────────────────── Active workout ───────────────────────── */

function ActiveWorkout() {
  const { state, dispatch, exerciseById } = useStore();
  const { t, exerciseName, muscleName, formatKg } = useI18n();
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
      Alert.alert(t('finish.noSetsTitle'), t('finish.noSetsBody'));
      return;
    }
    const total = active.exercises.reduce((n, e) => n + e.sets.length, 0);
    const skipped = total - done;
    Alert.alert(
      t('finish.title'),
      t('finish.message', {
        sets: t('count.set', { count: done }),
        volume: formatKg(workoutVolume(active)),
      }) +
        (skipped > 0 ? `\n\n${t('finish.skipped', { count: skipped })}` : ''),
      [
        { text: t('finish.keepGoing'), style: 'cancel' },
        {
          text: t('common.finish'),
          onPress: () => dispatch({ type: 'finishWorkout' }),
        },
      ],
    );
  };

  const discard = () =>
    Alert.alert(t('discard.title'), t('discard.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.discard'),
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
          <Text style={[type.kicker, { color: colors.accent }]}>
            {t('workout.live')}
          </Text>
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
              accessibilityLabel={t('workout.nameA11y')}
              returnKeyType="done"
            />
          )}
        </View>
        <Button title={t('common.finish')} onPress={finish} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.pad, { paddingBottom: spacing(40) }]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!(dragging && showReorder)}
      >
        <View style={styles.tiles}>
          <Clock startedAt={active.startedAt} />
          <StatTile
            label={t('home.sets')}
            value={String(completedSets(active))}
          />
          <StatTile
            label={t('home.volume')}
            value={formatKg(workoutVolume(active))}
          />
        </View>

        <RestSetting />

        {canReorder ? (
          <View style={styles.listHead}>
            <Text style={[type.kicker, styles.flex]}>
              {showReorder ? t('workout.dragHint') : t('workout.exercises')}
            </Text>
            <Button
              title={showReorder ? t('common.done') : t('workout.reorder')}
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
                title: ex ? exerciseName(ex) : t('workout.deletedExercise'),
                subtitle: [
                  ex ? muscleName(ex.muscle) : '',
                  t('workout.setsDone', { done, count: we.sets.length }),
                ]
                  .filter(Boolean)
                  .join(' · '),
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
          title={t('workout.addExercises')}
          variant="secondary"
          onPress={() => setPickerOpen(true)}
          style={styles.addBtn}
        />
        <Button
          title={t('workout.discard')}
          variant="ghost"
          onPress={discard}
        />
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
  const { t } = useI18n();
  const change = (d: number) =>
    dispatch({ type: 'setRestSeconds', seconds: state.restSeconds + d });
  return (
    <View style={styles.restSetting}>
      <Text style={styles.muted}>{t('workout.restBetween')}</Text>
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
  const { t, exerciseName, muscleName, ltr } = useI18n();
  const exercise = exerciseById(we.exerciseId);
  const name = exercise ? exerciseName(exercise) : t('workout.deletedExercise');
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
    Alert.alert(t('removeExercise.title'), name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
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
          <Text style={styles.exName}>{name}</Text>
          <Text style={styles.exMeta}>
            {[
              exercise ? muscleName(exercise.muscle) : '',
              we.targetReps
                ? t('exercise.target', {
                    range: ltr(`${we.sets.length} × ${we.targetReps}`),
                  })
                : '',
              best > 0 ? t('exercise.best', { weight: best }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
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
          accessibilityLabel={
            exercise
              ? t('exercise.removeA11y', { name })
              : t('exercise.removeFallbackA11y')
          }
        >
          <Text style={styles.removeText}>✕</Text>
        </Pressable>
      </View>

      {readyToProgress ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            {t('exercise.hint', { target, weight: lastTop + 2.5 })}
          </Text>
        </View>
      ) : null}

      <View style={styles.setRow}>
        <Text style={[styles.colSet, styles.colHead]}>{t('set.colSet')}</Text>
        <Text style={[styles.colPrev, styles.colHead]}>{t('set.colPrev')}</Text>
        <Text style={[styles.colInput, styles.colHead]}>{t('set.colKg')}</Text>
        <Text style={[styles.colInput, styles.colHead]}>
          {t('set.colReps')}
        </Text>
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
        accessibilityLabel={
          exercise
            ? t('exercise.addSetA11y', { name })
            : t('exercise.addSetFallbackA11y')
        }
      >
        <Text style={styles.addSetText}>{t('set.add')}</Text>
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
  const { t, ltr } = useI18n();
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
      Alert.alert(t('set.repsTitle'), t('set.repsBody'));
      return;
    }
    Vibration.vibrate(15);
    onDone();
    onUpdate({ done: true, weight, reps });
  };
  const confirmRemove = () =>
    Alert.alert(t('set.removeTitle', { n: index + 1 }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: onRemove },
    ]);
  return (
    <View>
      <View style={[styles.setRow, s.done && styles.setDone]}>
        <Pressable
          style={styles.colSet}
          onPress={confirmRemove}
          accessibilityRole="button"
          accessibilityLabel={t('set.removeA11y', { n: index + 1 })}
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
              ? t('set.usePrevious', { weight: prev.weight, reps: prev.reps })
              : t('set.noPrevious')
          }
        >
          <Text style={styles.prev}>
            {prev ? ltr(`${prev.weight || 0} × ${prev.reps || 0}`) : '—'}
          </Text>
        </Pressable>
        <TextInput
          style={[styles.colInput, styles.input, s.done && styles.inputDone]}
          value={s.weight}
          onChangeText={text => onUpdate({ weight: sanitizeWeight(text) })}
          keyboardType="decimal-pad"
          placeholder={weightHint || '0'}
          accessibilityLabel={t('set.weightA11y', { n: index + 1 })}
          placeholderTextColor={colors.muted}
          selectTextOnFocus
        />
        <TextInput
          style={[styles.colInput, styles.input, s.done && styles.inputDone]}
          value={s.reps}
          onChangeText={text => onUpdate({ reps: sanitizeReps(text) })}
          keyboardType="number-pad"
          placeholder={repsHint || '0'}
          accessibilityLabel={t('set.repsA11y', { n: index + 1 })}
          placeholderTextColor={colors.muted}
          selectTextOnFocus
        />
        <Pressable
          onPress={toggle}
          style={[styles.colCheck, styles.check, s.done && styles.checkOn]}
          hitSlop={6}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: s.done }}
          accessibilityLabel={t('set.completeA11y', { n: index + 1 })}
        >
          <Text style={[styles.checkMark, s.done && styles.checkMarkOn]}>
            ✓
          </Text>
        </Pressable>
      </View>
      {isPR ? (
        <View style={styles.prRow}>
          <Pill tone="gold" text={t('set.pr')} />
        </View>
      ) : null}
    </View>
  );
}

function Clock({ startedAt }: { startedAt: number }) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <StatTile label={t('workout.time')} value={formatTimer(now - startedAt)} />
  );
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
