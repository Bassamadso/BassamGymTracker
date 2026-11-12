import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { colors, spacing } from '../theme';
import { Exercise, MUSCLE_GROUPS, MuscleGroup } from '../types';
import { uid } from '../utils';
import { Button } from './ui';

/** Inline form for creating a custom exercise. */
export function ExerciseForm({
  onCreated,
  onCancel,
}: {
  onCreated?: (e: Exercise) => void;
  onCancel: () => void;
}) {
  const { dispatch } = useStore();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('Chest');

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exercise = { id: uid(), name: trimmed, muscle };
    dispatch({ type: 'addExercise', exercise });
    onCreated?.(exercise);
  };

  return (
    <View style={styles.box}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Exercise name"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoFocus
      />
      <View style={styles.chips}>
        {MUSCLE_GROUPS.map(m => (
          <Pressable
            key={m}
            onPress={() => setMuscle(m)}
            style={[styles.chip, muscle === m && styles.chipActive]}
          >
            <Text style={[styles.chipText, muscle === m && styles.chipTextOn]}>
              {m}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={onCancel}
          style={styles.flex}
        />
        <Button
          title="Save"
          onPress={save}
          disabled={!name.trim()}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing(4),
    marginBottom: spacing(3),
  },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginVertical: spacing(3),
  },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
  },
  chipActive: { backgroundColor: colors.accent },
  chipTextOn: { color: colors.onAccent, fontWeight: '800' },
  chipText: { color: colors.text, fontSize: 13 },
  row: { flexDirection: 'row', gap: spacing(3) },
  flex: { flex: 1 },
});
