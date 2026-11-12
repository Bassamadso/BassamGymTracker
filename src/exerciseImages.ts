import { EXERCISE_CATALOG } from './exerciseCatalog';
import { Exercise } from './types';

// Photos come from free-exercise-db (public domain), the same dataset as the
// catalog. Pinned to a commit so a later rename in the dataset can't break them.
const IMAGE_BASE =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises';

/** "Pull-up", "Pullups" and "pull ups" all compare equal (same rule as the store). */
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, '');

/** Dataset ids for the built-in exercises whose names differ from the dataset's. */
const ALIASES: Record<string, string> = {
  'Bench Press': 'Barbell_Bench_Press_-_Medium_Grip',
  'Chest Fly': 'Dumbbell_Flyes',
  Deadlift: 'Barbell_Deadlift',
  'Barbell Row': 'Bent_Over_Barbell_Row',
  'Lat Pulldown': 'Wide-Grip_Lat_Pulldown',
  Squat: 'Barbell_Squat',
  Lunge: 'Dumbbell_Lunges',
  'Leg Curl': 'Seated_Leg_Curl',
  'Calf Raise': 'Standing_Calf_Raises',
  'Overhead Press': 'Standing_Military_Press',
  'Lateral Raise': 'Side_Lateral_Raise',
  'Tricep Pushdown': 'Triceps_Pushdown',
  'Skull Crusher': 'EZ-Bar_Skullcrusher',
};

const aliasByKey = new Map(
  Object.entries(ALIASES).map(([n, id]) => [nameKey(n), id]),
);
const catalogByKey = new Map(
  EXERCISE_CATALOG.map(([id, name]) => [nameKey(name), id.replace(/^db-/, '')]),
);

/**
 * Photo of an exercise, or null when we have none (custom exercises, a few
 * dataset entries) — callers then show a placeholder instead.
 */
export function exerciseImageUrl(
  exercise: Pick<Exercise, 'id' | 'name'> | null | undefined,
): string | null {
  if (!exercise) return null;
  let dbId: string | undefined;
  if (exercise.id.startsWith('db-')) {
    dbId = exercise.id.slice(3);
  } else {
    // Built-ins and custom exercises: match by name
    const key = nameKey(exercise.name);
    dbId = aliasByKey.get(key) ?? catalogByKey.get(key);
  }
  return dbId ? `${IMAGE_BASE}/${encodeURIComponent(dbId)}/0.jpg` : null;
}
