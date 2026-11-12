import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { colors, spacing, type } from '../theme';
import { Routine, RoutineExercise } from '../types';
import { uid } from '../utils';
import { COLLAPSED_HEIGHT, DragSortList } from './DragSortList';
import { ExerciseIcon } from './ExerciseIcon';
import { ExercisePicker } from './ExercisePicker';
import { Button, Card, Empty } from './ui';

/** Edit one training day: name, exercises, target sets and reps. */
export function RoutineEditor({
  routine,
  isNew,
  onClose,
}: {
  routine: Routine;
  isNew?: boolean;
  onClose: () => void;
}) {
  const { dispatch, exerciseById } = useStore();
  const [draft, setDraft] = useState(routine);
  const [picking, setPicking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const listY = useRef(0);

  // Rows fold while dragging; bring the list to the top so every row is on screen
  const onDragChange = (isDragging: boolean) => {
    setDragging(isDragging);
    if (isDragging) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, listY.current - spacing(3)),
        animated: false,
      });
    }
  };

  const update = (id: string, patch: Partial<RoutineExercise>) =>
    setDraft(d => ({
      ...d,
      exercises: d.exercises.map(e => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const remove = (id: string) =>
    setDraft(d => ({ ...d, exercises: d.exercises.filter(e => e.id !== id) }));

  const reorder = (ids: string[]) =>
    setDraft(d => {
      // Never drops anything: exercises missing from `ids` keep their order at the end
      const rank = new Map(ids.map((id, i) => [id, i]));
      return {
        ...d,
        exercises: [...d.exercises].sort(
          (a, b) =>
            (rank.get(a.id) ?? ids.length) - (rank.get(b.id) ?? ids.length),
        ),
      };
    });

  const add = (ids: string[]) =>
    setDraft(d => ({
      ...d,
      exercises: [
        ...d.exercises,
        ...ids.map(exerciseId => ({
          id: uid(),
          exerciseId,
          sets: 3,
          reps: '8-12',
        })),
      ],
    }));

  const save = () => {
    dispatch({
      type: 'saveRoutine',
      routine: { ...draft, name: draft.name.trim() || routine.name },
    });
    onClose();
  };

  const del = () =>
    Alert.alert(
      `Delete "${routine.name}"?`,
      'This day is removed from your plan. Logged workouts are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'deleteRoutine', id: routine.id });
            onClose();
          },
        },
      ],
    );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.top}>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Text style={styles.topTitle}>
              {isNew ? 'New day' : 'Edit day'}
            </Text>
            <Button title="Save" variant="ghost" onPress={save} />
          </View>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!dragging}
          >
            <Text style={type.kicker}>Name</Text>
            <TextInput
              value={draft.name}
              onChangeText={name => setDraft(d => ({ ...d, name }))}
              placeholder="e.g. Push"
              placeholderTextColor={colors.muted}
              style={styles.nameInput}
              accessibilityLabel="Day name"
            />

            {draft.exercises.length === 0 ? (
              <Empty
                title="No exercises yet"
                subtitle="Add the movements you want to train on this day."
              />
            ) : (
              <View
                onLayout={e => {
                  listY.current = e.nativeEvent.layout.y;
                }}
              >
                <DragSortList
                  items={draft.exercises}
                  onReorder={reorder}
                  onDragChange={onDragChange}
                  renderItem={(
                    e,
                    { collapsed, dragging: lifted, handleProps },
                  ) => {
                    const ex = exerciseById(e.exerciseId);
                    const name = ex?.name ?? 'Deleted exercise';
                    return (
                      <Card
                        style={[
                          styles.card,
                          collapsed && styles.cardCollapsed,
                          lifted && styles.cardLifted,
                        ]}
                      >
                        <View style={styles.exHead}>
                          <View
                            {...handleProps}
                            accessibilityLabel={`Reorder ${name}. Drag to move.`}
                            accessibilityRole="button"
                            style={styles.handle}
                            hitSlop={{ top: 8, bottom: 8 }}
                          >
                            <Text style={styles.grip}>≡</Text>
                          </View>
                          <ExerciseIcon exercise={ex} size={44} />
                          <View style={styles.flex}>
                            <Text style={styles.exName} numberOfLines={1}>
                              {name}
                            </Text>
                            <Text style={styles.muted}>{ex?.muscle}</Text>
                          </View>
                          {collapsed ? (
                            <Text style={styles.sets}>
                              {e.sets} × {e.reps || '–'}
                            </Text>
                          ) : (
                            <IconBtn
                              label="✕"
                              a11y={`Remove ${name}`}
                              onPress={() => remove(e.id)}
                            />
                          )}
                        </View>
                        {collapsed ? null : (
                          <View style={styles.targets}>
                            <View style={styles.flex}>
                              <Text style={type.kicker}>Sets</Text>
                              <View style={styles.stepper}>
                                <IconBtn
                                  label="−"
                                  a11y="Fewer sets"
                                  onPress={() =>
                                    update(e.id, {
                                      sets: Math.max(1, e.sets - 1),
                                    })
                                  }
                                />
                                <Text style={styles.stepValue}>{e.sets}</Text>
                                <IconBtn
                                  label="+"
                                  a11y="More sets"
                                  onPress={() =>
                                    update(e.id, {
                                      sets: Math.min(10, e.sets + 1),
                                    })
                                  }
                                />
                              </View>
                            </View>
                            <View style={styles.flex}>
                              <Text style={type.kicker}>Target reps</Text>
                              <TextInput
                                value={e.reps}
                                onChangeText={t =>
                                  update(e.id, {
                                    reps: t.replace(/[^\d-]/g, ''),
                                  })
                                }
                                keyboardType="numbers-and-punctuation"
                                placeholder="8-12"
                                placeholderTextColor={colors.muted}
                                style={styles.repsInput}
                                accessibilityLabel="Target reps"
                              />
                            </View>
                          </View>
                        )}
                      </Card>
                    );
                  }}
                />
              </View>
            )}

            <Button
              title="+  Add exercises"
              variant="secondary"
              onPress={() => setPicking(true)}
              style={styles.gap}
            />
            {!isNew ? (
              <Button title="Delete this day" variant="ghost" onPress={del} />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>

        <ExercisePicker
          visible={picking}
          existingIds={draft.exercises.map(e => e.exerciseId)}
          onClose={() => setPicking(false)}
          onPick={add}
        />
      </SafeAreaView>
    </Modal>
  );
}

function IconBtn({
  label,
  a11y,
  onPress,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
    >
      <Text style={styles.iconText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(1),
  },
  topTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { paddingHorizontal: spacing(4), paddingBottom: spacing(10) },
  nameInput: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
    marginTop: spacing(2),
    marginBottom: spacing(4),
  },
  // DragSortList spaces the rows, so the card adds no margin of its own
  card: { marginBottom: 0 },
  cardCollapsed: {
    height: COLLAPSED_HEIGHT,
    justifyContent: 'center',
    paddingVertical: 0,
  },
  cardLifted: {
    borderColor: colors.accent,
    backgroundColor: colors.cardAlt,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  handle: {
    width: 36,
    height: 40,
    marginLeft: -spacing(1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { color: colors.muted, fontSize: 28, fontWeight: '700' },
  sets: {
    color: colors.accent,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  exName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12, marginTop: 2 },
  targets: { flexDirection: 'row', gap: spacing(4), marginTop: spacing(3) },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    marginTop: spacing(2),
  },
  stepValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    minWidth: 24,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  repsInput: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 10,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    marginTop: spacing(2),
    fontSize: 18,
    fontWeight: '800',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.6 },
  gap: { marginTop: spacing(1), marginBottom: spacing(2) },
});
