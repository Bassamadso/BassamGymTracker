import type { MessageKey } from './i18n/en';
import type { Translate } from './i18n/core';
import { Exercise, Routine, Workout } from './types';
import { uid } from './utils';

/** Exercises are matched by their English name, whatever the UI language. */
type Item = [name: string, sets: number, reps: string];
type DayTemplate = { name: MessageKey; items: Item[] };

const PUSH: DayTemplate = {
  name: 'day.push',
  items: [
    ['Bench Press', 4, '6-8'],
    ['Incline Dumbbell Press', 3, '8-10'],
    ['Overhead Press', 3, '8-10'],
    ['Lateral Raise', 3, '12-15'],
    ['Tricep Pushdown', 3, '10-12'],
  ],
};
const PULL: DayTemplate = {
  name: 'day.pull',
  items: [
    ['Deadlift', 3, '5'],
    ['Pull-up', 3, '6-10'],
    ['Barbell Row', 3, '8-10'],
    ['Face Pull', 3, '12-15'],
    ['Barbell Curl', 3, '10-12'],
  ],
};
const LEGS: DayTemplate = {
  name: 'day.legs',
  items: [
    ['Squat', 4, '6-8'],
    ['Romanian Deadlift', 3, '8-10'],
    ['Leg Press', 3, '10-12'],
    ['Leg Curl', 3, '10-12'],
    ['Calf Raise', 4, '12-15'],
  ],
};
const UPPER: DayTemplate = {
  name: 'day.upper',
  items: [
    ['Bench Press', 4, '6-8'],
    ['Barbell Row', 4, '6-8'],
    ['Overhead Press', 3, '8-10'],
    ['Lat Pulldown', 3, '10-12'],
    ['Hammer Curl', 2, '10-12'],
    ['Skull Crusher', 2, '10-12'],
  ],
};
const LOWER: DayTemplate = {
  name: 'day.lower',
  items: [
    ['Squat', 4, '6-8'],
    ['Romanian Deadlift', 3, '8-10'],
    ['Lunge', 3, '10-12'],
    ['Leg Curl', 3, '10-12'],
    ['Calf Raise', 3, '12-15'],
    ['Hanging Leg Raise', 3, '10-15'],
  ],
};
const PUSH_B: DayTemplate = {
  name: 'day.pushB',
  items: [
    ['Overhead Press', 4, '6-8'],
    ['Incline Dumbbell Press', 3, '8-10'],
    ['Chest Fly', 3, '12-15'],
    ['Lateral Raise', 3, '12-15'],
    ['Skull Crusher', 3, '10-12'],
  ],
};
const PULL_B: DayTemplate = {
  name: 'day.pullB',
  items: [
    ['Pull-up', 4, '6-10'],
    ['Seated Cable Row', 3, '8-12'],
    ['Lat Pulldown', 3, '10-12'],
    ['Face Pull', 3, '12-15'],
    ['Hammer Curl', 3, '10-12'],
  ],
};
const LEGS_B: DayTemplate = {
  name: 'day.legsB',
  items: [
    ['Leg Press', 4, '8-10'],
    ['Romanian Deadlift', 3, '8-10'],
    ['Lunge', 3, '10-12'],
    ['Leg Curl', 3, '12-15'],
    ['Calf Raise', 4, '12-15'],
    ['Cable Crunch', 3, '12-15'],
  ],
};

const rename = (t: DayTemplate, name: MessageKey): DayTemplate => ({
  ...t,
  name,
});

export interface SplitTemplate {
  days: number;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  template: DayTemplate[];
}

export const SPLITS: SplitTemplate[] = [
  {
    days: 3,
    titleKey: 'split.d3.title',
    descriptionKey: 'split.d3.desc',
    template: [PUSH, PULL, LEGS],
  },
  {
    days: 4,
    titleKey: 'split.d4.title',
    descriptionKey: 'split.d4.desc',
    template: [
      rename(UPPER, 'day.upperA'),
      rename(LOWER, 'day.lowerA'),
      rename(UPPER, 'day.upperB'),
      rename(LOWER, 'day.lowerB'),
    ],
  },
  {
    days: 5,
    titleKey: 'split.d5.title',
    descriptionKey: 'split.d5.desc',
    template: [PUSH, PULL, LEGS, UPPER, LOWER],
  },
  {
    days: 6,
    titleKey: 'split.d6.title',
    descriptionKey: 'split.d6.desc',
    template: [
      rename(PUSH, 'day.pushA'),
      rename(PULL, 'day.pullA'),
      rename(LEGS, 'day.legsA'),
      PUSH_B,
      PULL_B,
      LEGS_B,
    ],
  },
];

/**
 * Turns a split template into routines, matching exercises by name. Day names
 * are written in the language of `t` — they're saved as the user's own text.
 */
export function buildPlan(
  split: SplitTemplate | { days: number; template?: undefined },
  exercises: Exercise[],
  t: Translate,
): Routine[] {
  if (!split.template) {
    return Array.from({ length: split.days }, (_, i) => ({
      id: uid(),
      name: t('plan.day', { n: i + 1 }),
      exercises: [],
    }));
  }
  const byName = new Map(
    exercises.filter(e => !e.archived).map(e => [e.name, e.id]),
  );
  return split.template.map(day => ({
    id: uid(),
    name: t(day.name),
    exercises: day.items
      .filter(([name]) => byName.has(name))
      .map(([name, sets, reps]) => ({
        id: uid(),
        exerciseId: byName.get(name)!,
        sets,
        reps,
      })),
  }));
}

/** The routine that follows the most recently trained one. */
export function nextRoutine(routines: Routine[], history: Workout[]) {
  if (routines.length === 0) return undefined;
  const last = history.find(
    w => w.routineId && routines.some(r => r.id === w.routineId),
  );
  if (!last) return routines[0];
  const i = routines.findIndex(r => r.id === last.routineId);
  return routines[(i + 1) % routines.length];
}

/** Upper bound of a rep target like "8-12" → 12, "10" → 10. */
export const topOfRange = (reps: string) => {
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  return nums.length ? Math.max(...nums) : 0;
};

/** Lower bound of a rep target like "8-12" → 8. */
export const bottomOfRange = (reps: string) => {
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  return nums.length ? Math.min(...nums) : 0;
};
