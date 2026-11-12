import { Exercise, Routine, Workout } from './types';
import { uid } from './utils';

type Item = [name: string, sets: number, reps: string];
type DayTemplate = { name: string; items: Item[] };

const PUSH: DayTemplate = {
  name: 'Push',
  items: [
    ['Bench Press', 4, '6-8'],
    ['Incline Dumbbell Press', 3, '8-10'],
    ['Overhead Press', 3, '8-10'],
    ['Lateral Raise', 3, '12-15'],
    ['Tricep Pushdown', 3, '10-12'],
  ],
};
const PULL: DayTemplate = {
  name: 'Pull',
  items: [
    ['Deadlift', 3, '5'],
    ['Pull-up', 3, '6-10'],
    ['Barbell Row', 3, '8-10'],
    ['Face Pull', 3, '12-15'],
    ['Barbell Curl', 3, '10-12'],
  ],
};
const LEGS: DayTemplate = {
  name: 'Legs',
  items: [
    ['Squat', 4, '6-8'],
    ['Romanian Deadlift', 3, '8-10'],
    ['Leg Press', 3, '10-12'],
    ['Leg Curl', 3, '10-12'],
    ['Calf Raise', 4, '12-15'],
  ],
};
const UPPER: DayTemplate = {
  name: 'Upper',
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
  name: 'Lower',
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
  name: 'Push B',
  items: [
    ['Overhead Press', 4, '6-8'],
    ['Incline Dumbbell Press', 3, '8-10'],
    ['Chest Fly', 3, '12-15'],
    ['Lateral Raise', 3, '12-15'],
    ['Skull Crusher', 3, '10-12'],
  ],
};
const PULL_B: DayTemplate = {
  name: 'Pull B',
  items: [
    ['Pull-up', 4, '6-10'],
    ['Seated Cable Row', 3, '8-12'],
    ['Lat Pulldown', 3, '10-12'],
    ['Face Pull', 3, '12-15'],
    ['Hammer Curl', 3, '10-12'],
  ],
};
const LEGS_B: DayTemplate = {
  name: 'Legs B',
  items: [
    ['Leg Press', 4, '8-10'],
    ['Romanian Deadlift', 3, '8-10'],
    ['Lunge', 3, '10-12'],
    ['Leg Curl', 3, '12-15'],
    ['Calf Raise', 4, '12-15'],
    ['Cable Crunch', 3, '12-15'],
  ],
};

const rename = (t: DayTemplate, name: string): DayTemplate => ({ ...t, name });

export interface SplitTemplate {
  days: number;
  title: string;
  description: string;
  template: DayTemplate[];
}

export const SPLITS: SplitTemplate[] = [
  {
    days: 3,
    title: 'Push · Pull · Legs',
    description: 'Each muscle once a week. Great place to start.',
    template: [PUSH, PULL, LEGS],
  },
  {
    days: 4,
    title: 'Upper · Lower',
    description: 'Each muscle twice a week with a simple rotation.',
    template: [
      rename(UPPER, 'Upper A'),
      rename(LOWER, 'Lower A'),
      rename(UPPER, 'Upper B'),
      rename(LOWER, 'Lower B'),
    ],
  },
  {
    days: 5,
    title: 'PPL + Upper · Lower',
    description: 'Push, pull and legs, then a lighter upper/lower pair.',
    template: [PUSH, PULL, LEGS, UPPER, LOWER],
  },
  {
    days: 6,
    title: 'Push · Pull · Legs ×2',
    description: 'High frequency with two variations of each day.',
    template: [
      rename(PUSH, 'Push A'),
      rename(PULL, 'Pull A'),
      rename(LEGS, 'Legs A'),
      PUSH_B,
      PULL_B,
      LEGS_B,
    ],
  },
];

/** Turns a split template into routines, matching exercises by name. */
export function buildPlan(
  split: SplitTemplate | { days: number; template?: undefined },
  exercises: Exercise[],
): Routine[] {
  if (!split.template) {
    return Array.from({ length: split.days }, (_, i) => ({
      id: uid(),
      name: `Day ${i + 1}`,
      exercises: [],
    }));
  }
  const byName = new Map(
    exercises.filter(e => !e.archived).map(e => [e.name, e.id]),
  );
  return split.template.map(day => ({
    id: uid(),
    name: day.name,
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
