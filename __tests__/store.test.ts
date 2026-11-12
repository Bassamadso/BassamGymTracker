import { buildPlan, nextRoutine, SPLITS } from '../src/plans';
import {
  bestWeightFor,
  initialState,
  reducer,
  sanitize,
  State,
  withCatalog,
} from '../src/store';
import { EXERCISE_CATALOG } from '../src/exerciseCatalog';
import { MUSCLE_GROUPS } from '../src/types';
import {
  moveItem,
  prCounts,
  sanitizeWeight,
  slotAt,
  workoutVolume,
} from '../src/utils';

const loaded: State = { ...initialState, loaded: true };

test('logs a workout and saves only completed sets', () => {
  let s = reducer(loaded, { type: 'startWorkout' });
  expect(s.active).not.toBeNull();

  const benchId = s.exercises.find(e => e.name === 'Bench Press')!.id;
  s = reducer(s, { type: 'addToWorkout', exerciseIds: [benchId] });
  const we = s.active!.exercises[0];
  s = reducer(s, {
    type: 'updateSet',
    workoutExerciseId: we.id,
    setId: we.sets[0].id,
    patch: { weight: '60', reps: '8', done: true },
  });
  // New set copies previous values but is not done
  s = reducer(s, { type: 'addSet', workoutExerciseId: we.id });
  expect(s.active!.exercises[0].sets[1]).toMatchObject({
    weight: '60',
    reps: '8',
    done: false,
  });

  s = reducer(s, { type: 'finishWorkout' });
  expect(s.active).toBeNull();
  expect(s.history).toHaveLength(1);
  expect(s.history[0].exercises[0].sets).toHaveLength(1);
  expect(workoutVolume(s.history[0])).toBe(480);

  // Next workout pre-fills from the previous session
  s = reducer(s, { type: 'startWorkout' });
  s = reducer(s, { type: 'addToWorkout', exerciseIds: [benchId] });
  expect(s.active!.exercises[0].sets[0]).toMatchObject({
    weight: '60',
    reps: '8',
  });
});

describe('reordering a workout', () => {
  const started = () => {
    let s = reducer(loaded, { type: 'startWorkout' });
    s = reducer(s, {
      type: 'addToWorkout',
      exerciseIds: ['default-0', 'default-1', 'default-2'],
    });
    return s;
  };
  const order = (s: State) => s.active!.exercises.map(e => e.exerciseId);

  test('puts exercises in the requested order and keeps their sets', () => {
    let s = started();
    const [a, b, c] = s.active!.exercises;
    s = reducer(s, {
      type: 'updateSet',
      workoutExerciseId: a.id,
      setId: a.sets[0].id,
      patch: { weight: '60', reps: '8', done: true },
    });
    s = reducer(s, {
      type: 'reorderWorkout',
      workoutExerciseIds: [c.id, a.id, b.id],
    });
    expect(order(s)).toEqual(['default-2', 'default-0', 'default-1']);
    // Logged data travels with the exercise
    expect(s.active!.exercises[1].sets[0]).toMatchObject({
      weight: '60',
      done: true,
    });
  });

  test('ignores unknown ids and keeps unlisted exercises at the end', () => {
    let s = started();
    const [a, b, c] = s.active!.exercises;
    s = reducer(s, {
      type: 'reorderWorkout',
      workoutExerciseIds: ['nope', c.id],
    });
    // c first (listed); a and b were not listed so they follow in old order
    expect(s.active!.exercises.map(e => e.id)).toEqual([c.id, a.id, b.id]);
    expect(s.active!.exercises).toHaveLength(3);
  });

  test('does nothing without an active workout', () => {
    expect(
      reducer(loaded, { type: 'reorderWorkout', workoutExerciseIds: ['x'] }),
    ).toBe(loaded);
  });
});

test('finishing with no completed sets saves nothing', () => {
  let s = reducer(loaded, { type: 'startWorkout' });
  s = reducer(s, { type: 'finishWorkout' });
  expect(s.history).toHaveLength(0);
});

test('rest timer setting is clamped and PRs use the best logged weight', () => {
  let s = reducer(loaded, { type: 'setRestSeconds', seconds: 5 });
  expect(s.restSeconds).toBe(15);
  s = reducer(s, { type: 'setRestSeconds', seconds: 9999 });
  expect(s.restSeconds).toBe(600);

  const id = s.exercises[0].id;
  s = reducer(s, { type: 'startWorkout' });
  s = reducer(s, { type: 'addToWorkout', exerciseIds: [id] });
  const we = s.active!.exercises[0];
  s = reducer(s, {
    type: 'updateSet',
    workoutExerciseId: we.id,
    setId: we.sets[0].id,
    patch: { weight: '82.5', reps: '5', done: true },
  });
  s = reducer(s, { type: 'finishWorkout' });
  expect(bestWeightFor(s.history, id)).toBe(82.5);
});

describe('weekly plan', () => {
  test('builds a 3–6 day split from the exercise library', () => {
    for (const split of SPLITS) {
      const plan = buildPlan(split, loaded.exercises);
      expect(plan).toHaveLength(split.days);
      plan.forEach(r => expect(r.exercises.length).toBeGreaterThan(0));
    }
    expect(buildPlan(SPLITS[0], loaded.exercises).map(r => r.name)).toEqual([
      'Push',
      'Pull',
      'Legs',
    ]);
    expect(buildPlan({ days: 4 }, loaded.exercises)[3]).toMatchObject({
      name: 'Day 4',
      exercises: [],
    });
  });

  test('starting a day creates its sets and next time pre-fills last weights', () => {
    const routines = buildPlan(SPLITS[0], loaded.exercises);
    let s = reducer(loaded, { type: 'setPlan', routines });
    expect(nextRoutine(s.routines, s.history)?.name).toBe('Push');

    s = reducer(s, { type: 'startRoutine', id: routines[0].id });
    const first = s.active!.exercises[0];
    expect(s.active!.routineId).toBe(routines[0].id);
    expect(first.sets).toHaveLength(routines[0].exercises[0].sets);
    expect(first.targetReps).toBe('6-8');
    expect(first.sets[0]).toMatchObject({ weight: '', reps: '6' });

    s = reducer(s, {
      type: 'updateSet',
      workoutExerciseId: first.id,
      setId: first.sets[0].id,
      patch: { weight: '70', reps: '8', done: true },
    });
    s = reducer(s, { type: 'finishWorkout' });
    expect(nextRoutine(s.routines, s.history)?.name).toBe('Pull');

    s = reducer(s, { type: 'startRoutine', id: routines[0].id });
    expect(s.active!.exercises[0].sets[0]).toMatchObject({
      weight: '70',
      reps: '8',
      done: false,
    });
  });

  test('routines can be edited and deleted', () => {
    const [push] = buildPlan(SPLITS[0], loaded.exercises);
    let s = reducer(loaded, { type: 'saveRoutine', routine: push });
    s = reducer(s, {
      type: 'saveRoutine',
      routine: { ...push, name: 'Chest day' },
    });
    expect(s.routines).toHaveLength(1);
    expect(s.routines[0].name).toBe('Chest day');
    s = reducer(s, { type: 'deleteRoutine', id: push.id });
    expect(s.routines).toHaveLength(0);
  });
});

test('deleting an exercise archives it so history keeps its name', () => {
  const id = loaded.exercises[0].id;
  const s = reducer(loaded, { type: 'deleteExercise', id });
  expect(s.exercises.find(e => e.id === id)).toMatchObject({ archived: true });
});

test('rest timer lives in the store and is cleared when the workout ends', () => {
  let s = reducer(loaded, { type: 'startWorkout' });
  s = reducer(s, { type: 'startRest' });
  expect(s.rest?.total).toBe(90);
  s = reducer(s, { type: 'adjustRest', endsAt: 123 });
  expect(s.rest?.endsAt).toBe(123);
  s = reducer(s, { type: 'discardWorkout' });
  expect(s.rest).toBeNull();
});

test('sanitize ignores damaged fields', () => {
  expect(sanitize(null)).toEqual({});
  expect(sanitize({ history: 'oops', exercises: [], restSeconds: 60 })).toEqual(
    { restSeconds: 60 },
  );
});

describe('exercise catalog', () => {
  test('is well-formed: unique ids, known muscle groups', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThan(800);
    expect(new Set(EXERCISE_CATALOG.map(e => e[0])).size).toBe(
      EXERCISE_CATALOG.length,
    );
    for (const [id, name, muscle] of EXERCISE_CATALOG) {
      expect(id).toMatch(/^db-/);
      expect(name.trim()).not.toBe('');
      expect(MUSCLE_GROUPS).toContain(muscle);
    }
  });

  test('fresh installs get the defaults first, then the catalog', () => {
    expect(initialState.exercises[0].id).toBe('default-0');
    expect(initialState.exercises.length).toBeGreaterThan(800);
    expect(new Set(initialState.exercises.map(e => e.id)).size).toBe(
      initialState.exercises.length,
    );
  });

  test('does not duplicate a default that the catalog also has', () => {
    const names = initialState.exercises.map(e => e.name.toLowerCase());
    // The catalog calls these "Pushups", "Hammer Curls" and "Plank"
    expect(names.filter(n => /^push-?ups?$/.test(n))).toHaveLength(1);
    expect(names.filter(n => /^hammer curls?$/.test(n))).toHaveLength(1);
    expect(names.filter(n => n === 'plank')).toHaveLength(1);
  });

  test('existing saves keep their exercises and gain the catalog', () => {
    const saved = [
      { id: 'default-0', name: 'Bench Press', muscle: 'Chest' },
      { id: 'mine', name: 'Zercher Squat Special', muscle: 'Legs' },
      // A custom exercise the catalog also has, spelled differently
      { id: 'custom-pu', name: 'Pull ups', muscle: 'Back' },
    ];
    const out = sanitize({ exercises: saved }).exercises!;
    expect(out.slice(0, 3)).toEqual(saved);
    expect(out.length).toBeGreaterThan(800);
    // Only the user's "Pull ups" remains; the catalog's "Pullups" is skipped
    const pullUps = out.filter(e => /^pull[- ]?ups?$/i.test(e.name));
    expect(pullUps.map(e => e.id)).toEqual(['custom-pu']);
  });

  test('deleted exercises stay deleted when the catalog is re-applied', () => {
    const catalogId = EXERCISE_CATALOG[0][0];
    let s = reducer(loaded, { type: 'deleteExercise', id: catalogId });
    s = { ...s, ...sanitize({ exercises: s.exercises }) };
    const matches = s.exercises.filter(e => e.id === catalogId);
    expect(matches).toHaveLength(1);
    expect(matches[0].archived).toBe(true);
    // Re-applying is a no-op, not a second copy
    expect(withCatalog(s.exercises)).toBe(s.exercises);
  });
});

test('moveItem moves one item without mutating the input', () => {
  const list = ['a', 'b', 'c', 'd'];
  expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  expect(moveItem(list, 1, 1)).toBe(list);
  expect(moveItem(list, 9, 0)).toBe(list);
  expect(moveItem(list, 0, 99)).toEqual(['b', 'c', 'd', 'a']);
  expect(list).toEqual(['a', 'b', 'c', 'd']);
});

test('slotAt snaps a dragged row to the nearest slot and stays in range', () => {
  expect(slotAt(0, 72, 4)).toBe(0);
  expect(slotAt(35, 72, 4)).toBe(0); // just under half a row
  expect(slotAt(37, 72, 4)).toBe(1); // just over half a row
  expect(slotAt(72 * 3, 72, 4)).toBe(3);
  expect(slotAt(-500, 72, 4)).toBe(0);
  expect(slotAt(9999, 72, 4)).toBe(3);
});

test('sanitizeWeight keeps one decimal point', () => {
  expect(sanitizeWeight('62,5')).toBe('62.5');
  expect(sanitizeWeight('1.2.3')).toBe('1.23');
  expect(sanitizeWeight('8a0')).toBe('80');
});

test('prCounts flags workouts that beat earlier bests', () => {
  const w = (id: string, weight: string) => ({
    id,
    name: id,
    startedAt: 0,
    exercises: [
      {
        id: id + 'e',
        exerciseId: 'x',
        sets: [{ id: id + 's', weight, reps: '5', done: true }],
      },
    ],
  });
  // newest first
  expect(prCounts([w('c', '90'), w('b', '80'), w('a', '100')])).toEqual({
    a: 0,
    b: 0,
    c: 0,
  });
  expect(prCounts([w('c', '110'), w('b', '80'), w('a', '100')])).toEqual({
    a: 0,
    b: 0,
    c: 1,
  });
});
