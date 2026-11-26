import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { buildPlan, SPLITS } from '../plans';
import { useStore } from '../store';
import { colors, spacing, type } from '../theme';
import { Text } from './Text';
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
  const { t, exerciseName, ltr } = useI18n();
  const [days, setDays] = useState(3);
  const [custom, setCustom] = useState(false);
  const split = SPLITS.find(s => s.days === days)!;
  const preview = useMemo(
    () => buildPlan(custom ? { days } : split, state.exercises, t),
    [custom, days, split, state.exercises, t],
  );

  const apply = () => {
    const save = () => {
      dispatch({ type: 'setPlan', routines: preview });
      onClose();
    };
    if (state.routines.length) {
      Alert.alert(t('plan.replaceTitle'), t('plan.replaceBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.replace'), style: 'destructive', onPress: save },
      ]);
    } else {
      save();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <Header
          kicker={t('plan.weekly')}
          title={t('plan.yourSplit')}
          right={
            <Button
              title={t('common.cancel')}
              variant="ghost"
              onPress={onClose}
            />
          }
        />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.question}>{t('plan.howMany')}</Text>
          <View style={styles.days}>
            {DAY_OPTIONS.map(d => (
              <Pressable
                key={d}
                onPress={() => setDays(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: d === days }}
                accessibilityLabel={t('plan.daysPerWeek', { count: d })}
                style={[styles.day, d === days && styles.dayOn]}
              >
                <Text style={[styles.dayNum, d === days && styles.dayTextOn]}>
                  {d}
                </Text>
                <Text style={[styles.dayLabel, d === days && styles.dayTextOn]}>
                  {t('plan.days')}
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
                {t('plan.recommended')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCustom(true)}
              style={[styles.mode, custom && styles.modeOn]}
            >
              <Text style={[styles.modeText, custom && styles.modeTextOn]}>
                {t('plan.custom')}
              </Text>
            </Pressable>
          </View>

          {custom ? (
            <Text style={styles.desc}>
              {t('plan.emptyDays', { count: days })}
            </Text>
          ) : (
            <>
              <Text style={styles.splitTitle}>{t(split.titleKey)}</Text>
              <Text style={styles.desc}>{t(split.descriptionKey)}</Text>
            </>
          )}

          {preview.map((r, i) => (
            <Card key={r.id}>
              <Text style={type.kicker}>{t('plan.day', { n: i + 1 })}</Text>
              <Text style={styles.routineName}>{r.name}</Text>
              {r.exercises.length ? (
                r.exercises.map(e => {
                  const ex = exerciseById(e.exerciseId);
                  return (
                    <Text key={e.id} style={styles.exLine}>
                      {ex ? exerciseName(ex) : t('workout.deletedExercise')}
                      <Text style={styles.muted}>
                        {'  '}
                        {ltr(`${e.sets} × ${e.reps}`)}
                      </Text>
                    </Text>
                  );
                })
              ) : (
                <Text style={styles.muted}>{t('common.noExercises')}</Text>
              )}
            </Card>
          ))}

          <Button big title={t('plan.use')} onPress={apply} />
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
