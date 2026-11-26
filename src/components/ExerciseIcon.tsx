import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { exerciseImageUrl } from '../exerciseImages';
import { useI18n } from '../i18n';
import { colors } from '../theme';
import { Exercise } from '../types';
import { Text } from './Text';

/** "Barbell Curl" → "BC", "Plank" → "P". Shown when there is no photo. */
function initials(name: string) {
  const words = name.match(/[A-Za-z0-9\u0621-\u064A]+/g) ?? [];
  return words
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

/**
 * Square thumbnail of an exercise. Falls back to the name's initials when the
 * exercise has no photo, the device is offline, or the image fails to load.
 */
export function ExerciseIcon({
  exercise,
  size = 44,
}: {
  exercise: Pick<Exercise, 'id' | 'name'> | null | undefined;
  size?: number;
}) {
  const { exerciseName } = useI18n();
  // Photos are matched on the stored (English) name; initials use the shown one
  const url = exerciseImageUrl(exercise);
  // Remember which url failed, so a different exercise reusing this row retries
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = url !== null && failed !== url;

  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: Math.round(size * 0.25) },
      ]}
      // Decorative: the name is always rendered right next to it
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>
        {exercise ? initials(exerciseName(exercise)) : '?'}
      </Text>
      {showImage ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(url)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { color: colors.muted, fontWeight: '800', letterSpacing: 0.5 },
});
