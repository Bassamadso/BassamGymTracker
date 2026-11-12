import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { colors, spacing } from '../theme';
import { MUSCLE_GROUPS, MuscleGroup } from '../types';
import { ExerciseForm } from './ExerciseForm';
import { ExerciseIcon } from './ExerciseIcon';
import { Button } from './ui';

/** Full-screen modal to pick one or more exercises to add to a workout. */
export function ExercisePicker({
  visible,
  onClose,
  onPick,
  existingIds = [],
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  /** Exercises already in the workout/day; shown as added and not selectable. */
  existingIds?: string[];
}) {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.exercises
      .filter(
        e =>
          !e.archived &&
          (!muscle || e.muscle === muscle) &&
          e.name.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.exercises, query, muscle]);

  const toggle = (id: string) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const close = () => {
    setSelected([]);
    setQuery('');
    setMuscle(null);
    setCreating(false);
    onClose();
  };

  const confirm = () => {
    onPick(selected);
    close();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Button title="Cancel" variant="ghost" onPress={close} />
          <Text style={styles.title}>Add Exercises</Text>
          <Button
            title={selected.length ? `Add (${selected.length})` : 'Add'}
            variant="ghost"
            onPress={confirm}
            disabled={!selected.length}
          />
        </View>

        <View style={styles.pad}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={colors.muted}
            style={styles.search}
          />
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[null, ...MUSCLE_GROUPS]}
            keyExtractor={m => m ?? 'all'}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setMuscle(item)}
                style={[styles.chip, muscle === item && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    muscle === item && styles.chipTextOn,
                  ]}
                >
                  {item ?? 'All'}
                </Text>
              </Pressable>
            )}
          />
          {creating ? (
            <ExerciseForm
              onCancel={() => setCreating(false)}
              onCreated={e => {
                setCreating(false);
                setSelected(s => [...s, e.id]);
              }}
            />
          ) : (
            <Button
              title="+ Create new exercise"
              variant="secondary"
              onPress={() => setCreating(true)}
              style={{ marginBottom: spacing(3) }}
            />
          )}
        </View>

        <FlatList
          data={list}
          keyExtractor={e => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.pad}
          renderItem={({ item }) => {
            const on = selected.includes(item.id);
            const added = existingIds.includes(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                disabled={added}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on || added, disabled: added }}
                style={[styles.row, on && styles.rowOn, added && styles.added]}
              >
                <ExerciseIcon exercise={item} size={48} />
                <View style={styles.flex}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.muscle}>
                    {added ? `${item.muscle} · already added` : item.muscle}
                  </Text>
                </View>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(1),
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  pad: { paddingHorizontal: spacing(4) },
  search: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    fontSize: 16,
  },
  chips: { gap: spacing(2), paddingVertical: spacing(3) },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.accent },
  chipTextOn: { color: colors.onAccent, fontWeight: '800' },
  chipText: { color: colors.text, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing(3),
    marginBottom: spacing(2),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  flex: { flex: 1 },
  rowOn: { borderColor: colors.accent },
  added: { opacity: 0.45 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muscle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: colors.onAccent, fontWeight: '900', fontSize: 13 },
});
