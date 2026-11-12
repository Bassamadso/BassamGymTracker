import {
  coerceLegacy,
  createDataStore,
  Persisted,
  SqlDb,
} from '../src/storage';
import { Workout } from '../src/types';
import { failingOn, openMemoryDb } from '../test-utils/nodeSqlite';

const empty: Persisted = {
  exercises: [],
  history: [],
  active: null,
  restSeconds: 90,
  routines: [],
  rest: null,
};

const workout = (id: string, startedAt: number, weight = '62.5'): Workout => ({
  id,
  name: `Workout ${id}`,
  startedAt,
  finishedAt: startedAt + 3600000,
  routineId: 'r1',
  exercises: [
    {
      id: `we-${id}`,
      exerciseId: 'default-0',
      targetReps: '6-8',
      sets: [
        { id: `${id}-s1`, weight, reps: '8', done: true },
        { id: `${id}-s2`, weight: '', reps: '6', done: true },
      ],
    },
  ],
});

const count = async (db: SqlDb, table: string) =>
  Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);

test('creates the schema once and can be opened again', async () => {
  const db = openMemoryDb();
  await createDataStore(db);
  await createDataStore(db);
  expect((await db.execute('PRAGMA user_version')).rows[0].user_version).toBe(1);
  const tables = (
    await db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
  ).rows.map(r => r.name);
  expect(tables).toEqual(
    expect.arrayContaining([
      'meta',
      'exercises',
      'workouts',
      'workout_exercises',
      'sets',
      'routines',
      'routine_exercises',
    ]),
  );
});

test('a fresh database loads as empty', async () => {
  const store = await createDataStore(openMemoryDb());
  expect(await store.load()).toEqual({
    exercises: [],
    history: [],
    routines: [],
  });
});

test('saves and reloads everything, newest workout first', async () => {
  const db = openMemoryDb();
  const store = await createDataStore(db);
  const next: Persisted = {
    exercises: [
      // Built in and untouched: shipped with the app, so not saved
      { id: 'default-0', name: 'Bench Press', muscle: 'Chest' },
      { id: 'mine', name: 'Zercher Squat', muscle: 'Legs' },
      // Built in but archived: that has to survive a restart
      { id: 'db-Plank', name: 'Plank', muscle: 'Core', archived: true },
    ],
    history: [workout('w2', 2000000000000), workout('w1', 1000000000000)],
    active: {
      id: 'live',
      name: 'Evening Workout',
      startedAt: 5,
      exercises: [
        {
          id: 'we',
          exerciseId: 'mine',
          sets: [{ id: 's', weight: '40.', reps: '', done: false }],
        },
      ],
    },
    restSeconds: 120,
    rest: { endsAt: 123, total: 90 },
    routines: [
      {
        id: 'r1',
        name: 'Push',
        exercises: [{ id: 're1', exerciseId: 'default-0', sets: 4, reps: '6-8' }],
      },
      { id: 'r2', name: 'Pull', exercises: [] },
    ],
  };
  await store.save(empty, next);

  const loaded = await (await createDataStore(db)).load();
  expect(loaded.exercises).toEqual([
    { id: 'mine', name: 'Zercher Squat', muscle: 'Legs' },
    { id: 'db-Plank', name: 'Plank', muscle: 'Core', archived: true },
  ]);
  expect(loaded.history!.map(w => w.id)).toEqual(['w2', 'w1']);
  // Numbers come back as the same strings the inputs show; blanks stay blank
  expect(loaded.history![1]).toEqual(next.history[1]);
  expect(loaded.history![0].exercises[0].sets[1].weight).toBe('');
  expect(loaded.routines).toEqual(next.routines);
  // The workout in progress is stored as typed, half-finished values included
  expect(loaded.active).toEqual(next.active);
  expect(loaded.rest).toEqual(next.rest);
  expect(loaded.restSeconds).toBe(120);
});

test('typing in a set rewrites one small row, not the history', async () => {
  const db = openMemoryDb();
  const store = await createDataStore(db);
  const base: Persisted = {
    ...empty,
    history: [workout('w1', 1000), workout('w0', 500)],
  };
  await store.save(empty, base);

  const typed: Persisted = {
    ...base,
    active: { id: 'live', name: 'Live', startedAt: 1, exercises: [] },
  };
  db.statements.length = 0;
  await store.save(base, typed);

  expect(db.statements).toHaveLength(1);
  expect(db.statements[0]).toMatch(/INTO meta/);
});

test('finishing a workout adds only that workout', async () => {
  const db = openMemoryDb();
  const store = await createDataStore(db);
  const before: Persisted = { ...empty, history: [workout('w1', 1000)] };
  await store.save(empty, before);

  const after: Persisted = {
    ...before,
    history: [workout('w2', 2000), ...before.history],
  };
  await store.save(before, after);

  expect(await count(db, 'workouts')).toBe(2);
  expect(await count(db, 'sets')).toBe(4);
  const loaded = await store.load();
  expect(loaded.history!.map(w => w.id)).toEqual(['w2', 'w1']);
});

test('deleting a workout removes its exercises and sets too', async () => {
  const db = openMemoryDb();
  const store = await createDataStore(db);
  const full: Persisted = {
    ...empty,
    history: [workout('w2', 2000), workout('w1', 1000)],
  };
  await store.save(empty, full);
  await store.save(full, { ...full, history: [full.history[0]] });

  expect(await count(db, 'workouts')).toBe(1);
  expect(await count(db, 'workout_exercises')).toBe(1);
  expect(await count(db, 'sets')).toBe(2);
});

test('removing a day from the plan removes its exercises', async () => {
  const db = openMemoryDb();
  const store = await createDataStore(db);
  const plan: Persisted = {
    ...empty,
    routines: [
      {
        id: 'r1',
        name: 'Push',
        exercises: [{ id: 're1', exerciseId: 'default-0', sets: 3, reps: '8' }],
      },
    ],
  };
  await store.save(empty, plan);
  await store.save(plan, { ...plan, routines: [] });
  expect(await count(db, 'routines')).toBe(0);
  expect(await count(db, 'routine_exercises')).toBe(0);
});

test('a save that fails part-way leaves nothing behind', async () => {
  const db = openMemoryDb();
  const broken = await createDataStore(failingOn(db, /INTO sets/));
  const next: Persisted = { ...empty, history: [workout('w1', 1000)] };

  await expect(broken.save(empty, next)).rejects.toThrow('disk full');

  expect(await count(db, 'workouts')).toBe(0);
  expect(await count(db, 'workout_exercises')).toBe(0);
});

test('large workouts are split into statements under the parameter limit', async () => {
  const db = openMemoryDb();
  const store = await createDataStore(db);
  const big = workout('big', 1000);
  big.exercises[0].sets = Array.from({ length: 400 }, (_, i) => ({
    id: `s${i}`,
    weight: String(i),
    reps: '5',
    done: true,
  }));
  await store.save(empty, { ...empty, history: [big] });
  expect(await count(db, 'sets')).toBe(400);
  expect((await store.load()).history![0].exercises[0].sets).toHaveLength(400);
});

describe('importing the old AsyncStorage save', () => {
  const old = {
    exercises: [
      { id: 'default-0', name: 'Bench Press', muscle: 'Chest' },
      { id: 'mine', name: 'Zercher Squat', muscle: 'Nonsense' },
      { id: 'db-Plank', name: 'Plank', muscle: 'Core', archived: true },
      { name: 'no id' },
    ],
    history: [workout('w2', 2000), 'garbage', workout('w1', 1000)],
    routines: [
      {
        id: 'r1',
        name: 'Push',
        exercises: [{ id: 're1', exerciseId: 'default-0', sets: 4, reps: '6-8' }],
      },
    ],
    restSeconds: 75,
  };

  test('brings everything across, once', async () => {
    const db = openMemoryDb();
    const store = await createDataStore(db);
    expect(await store.needsLegacyImport()).toBe(true);

    await store.importLegacy(JSON.stringify(old));
    expect(await store.needsLegacyImport()).toBe(false);

    const loaded = await store.load();
    expect(loaded.history!.map(w => w.id)).toEqual(['w2', 'w1']);
    expect(loaded.routines).toEqual(old.routines);
    expect(loaded.restSeconds).toBe(75);
    // Damaged records are fixed or dropped, never fatal
    expect(loaded.exercises).toEqual([
      { id: 'mine', name: 'Zercher Squat', muscle: 'Other' },
      { id: 'db-Plank', name: 'Plank', muscle: 'Core', archived: true },
    ]);
  });

  test('a missing save still marks the import done', async () => {
    const store = await createDataStore(openMemoryDb());
    await store.importLegacy(null);
    expect(await store.needsLegacyImport()).toBe(false);
    expect((await store.load()).history).toEqual([]);
  });

  test('an unreadable save is skipped and does not block start-up', async () => {
    const store = await createDataStore(openMemoryDb());
    await store.importLegacy('{"history": [');
    expect(await store.needsLegacyImport()).toBe(false);
    expect((await store.load()).history).toEqual([]);
  });

  test('an interrupted import is rolled back and tried again next launch', async () => {
    const db = openMemoryDb();
    const broken = await createDataStore(failingOn(db, /INTO workouts/));
    await expect(broken.importLegacy(JSON.stringify(old))).rejects.toThrow();

    expect(await count(db, 'routines')).toBe(0);
    const retry = await createDataStore(db);
    expect(await retry.needsLegacyImport()).toBe(true);
    await retry.importLegacy(JSON.stringify(old));
    expect((await retry.load()).history).toHaveLength(2);
  });
});

test('coerceLegacy ignores damaged fields', () => {
  expect(coerceLegacy(null)).toEqual({});
  expect(coerceLegacy([])).toEqual({});
  const out = coerceLegacy({
    history: 'oops',
    active: 5,
    restSeconds: 'x',
    rest: { endsAt: 1 },
  });
  expect(out.history).toEqual([]);
  expect(out.active).toBeUndefined();
  expect(out.restSeconds).toBeUndefined();
  expect(out.rest).toBeUndefined();
});
