import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from '../components/BarChart';
import { ExerciseForm } from '../components/ExerciseForm';
import { ExerciseIcon } from '../components/ExerciseIcon';
import { Text } from '../components/Text';
import { Button, Card, Empty, Header, StatTile } from '../components/ui';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import { colors, spacing, type } from '../theme';
import { Exercise, MUSCLE_GROUPS, Workout } from '../types';
import { e1rm } from '../utils';

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
  const { t, exerciseName, muscleName, matchesSearch, compare } = useI18n();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Exercise | null>(null);

  const sections = useMemo(
    () =>
      MUSCLE_GROUPS.map(m => ({
        title: muscleName(m),
        data: state.exercises
          .filter(e => !e.archived && e.muscle === m && matchesSearch(e, query))
          .sort((a, b) => compare(exerciseName(a), exerciseName(b))),
      })).filter(s => s.data.length > 0),
    [state.exercises, query, muscleName, matchesSearch, compare, exerciseName],
  );

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
      t('library.deleteTitle'),
      t('library.deleteBody', { name: exerciseName(e) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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
              kicker={t('count.movement', {
                count: state.exercises.filter(e => !e.archived).length,
              })}
              title={t('library.title')}
              right={
                !creating ? (
                  <Button
                    title={t('library.new')}
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
                placeholder={t('library.search')}
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
                <Text style={styles.name}>{exerciseName(item)}</Text>
                <Text style={styles.meta}>
                  {s
                    ? t('count.session', { count: s.sessions })
                    : t('library.notLogged')}
                </Text>
              </View>
              {s && s.top > 0 ? (
                <View style={styles.best}>
                  <Text style={styles.bestValue}>{s.top}</Text>
                  <Text style={styles.bestUnit}>{t('library.bestUnit')}</Text>
                </View>
              ) : null}
              {/* › is bidi-mirrored, so the platform already points it forward in RTL */}
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Text style={styles.hint}>{t('library.hint')}</Text>
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
  const { t, exerciseName, muscleName, formatDate, formatDateShort, ltr } =
    useI18n();
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
          kicker={muscleName(exercise.muscle)}
          title={exerciseName(exercise)}
          right={
            <Button
              title={t('common.close')}
              variant="ghost"
              onPress={onClose}
            />
          }
        />
        <ScrollView contentContainerStyle={[styles.pad, styles.list]}>
          <View style={styles.hero}>
            <ExerciseIcon exercise={exercise} size={140} />
          </View>
          {sessions.length === 0 ? (
            <Empty
              title={t('library.noDataTitle')}
              subtitle={t('library.noDataBody')}
            />
          ) : (
            <>
              <View style={styles.tiles}>
                <StatTile
                  label={t('library.best')}
                  value={`${best}`}
                  unit={t('unit.kg')}
                />
                <StatTile
                  label={t('library.e1rm')}
                  value={`${Math.round(best1rm)}`}
                  unit={t('unit.kg')}
                />
                <StatTile
                  label={t('library.progress')}
                  value={ltr(`${gain >= 0 ? '+' : ''}${gain}`)}
                  unit={t('unit.kg')}
                />
              </View>
              <Card>
                <Text style={[type.kicker, { marginBottom: spacing(4) }]}>
                  {t('library.topWeight')}
                </Text>
                <BarChart
                  values={recent.map(s => s.top)}
                  labels={recent.map(s => formatDateShort(s.date))}
                />
              </Card>
              <Text style={[type.kicker, styles.section]}>
                {t('library.recent')}
              </Text>
              {[...sessions]
                .reverse()
                .slice(0, 8)
                .map((s, i) => (
                  <Card key={i}>
                    <View style={styles.sessionHead}>
                      <Text style={styles.name}>{formatDate(s.date)}</Text>
                      <Text style={styles.meta}>
                        {t('library.top', { weight: s.top })}
                      </Text>
                    </View>
                    <Text style={styles.sessionSets}>
                      {s.sets
                        .map(x => ltr(`${x.weight || 0}×${x.reps || 0}`))
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
