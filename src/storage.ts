import type { State } from './store';
import {
  Exercise,
  MUSCLE_GROUPS,
  MuscleGroup,
  Routine,
  RoutineExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './types';
import { uid } from './utils';

/**
 * SQLite persistence.
 *
 * The reducer in store.tsx stays the source of truth while the app runs. This
 * module loads everything once at start-up and then writes only what changed:
 *
 * - finished workouts, routines and custom exercises live in real tables;
 * - the workout in progress, the rest timer and settings live in `meta` as
 *   small JSON values, so typing a weight rewrites one row, not the history.
 *
 * It only talks to the `SqlDb` interface below, so tests can run it against any
 * SQLite engine without the native module.
 */

/** The part of the app state that is saved. */
export type Persisted = Omit<State, 'loaded'>;

type Param = string | number | null;

export interface SqlExecutor {
  execute(
    sql: string,
    params?: Param[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface SqlDb extends SqlExecutor {
  /** Runs `fn` atomically: if it throws, every change it made is rolled back. */
  transaction(fn: (tx: SqlExecutor) => Promise<void>): Promise<void>;
}

export interface DataStore {
  /** True on the first launch after upgrading from the AsyncStorage version. */
  needsLegacyImport(): Promise<boolean>;
  /**
   * Imports the old single-JSON save (`null` when there was none). A damaged
   * save is skipped, not deleted — the caller keeps the original untouched.
   */
  importLegacy(raw: string | null): Promise<void>;
  /** Everything saved, in the shapes the reducer uses. */
  load(): Promise<Partial<Persisted>>;
  /** Writes the differences between two states in a single transaction. */
  save(prev: Persisted, next: Persisted): Promise<void>;
}

/* ───────────────────────────── schema ───────────────────────────── */

/**
 * One entry per schema version; `PRAGMA user_version` records how many have
 * been applied. Add a new entry to change the schema — never edit an old one.
 */
const SCHEMA: string[][] = [
  [
    `CREATE TABLE meta (
       key TEXT PRIMARY KEY NOT NULL,
       value TEXT NOT NULL
     )`,
    `CREATE TABLE exercises (
       id TEXT PRIMARY KEY NOT NULL,
       name TEXT NOT NULL,
       muscle TEXT NOT NULL,
       archived INTEGER NOT NULL DEFAULT 0
     )`,
    `CREATE TABLE workouts (
       id TEXT PRIMARY KEY NOT NULL,
       name TEXT NOT NULL,
       started_at INTEGER NOT NULL,
       finished_at INTEGER,
       routine_id TEXT
     )`,
    `CREATE TABLE workout_exercises (
       id TEXT PRIMARY KEY NOT NULL,
       workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
       exercise_id TEXT NOT NULL,
       target_reps TEXT,
       position INTEGER NOT NULL
     )`,
    `CREATE TABLE sets (
       id TEXT PRIMARY KEY NOT NULL,
       workout_exercise_id TEXT NOT NULL
         REFERENCES workout_exercises(id) ON DELETE CASCADE,
       position INTEGER NOT NULL,
       weight REAL,
       reps INTEGER,
       done INTEGER NOT NULL DEFAULT 1
     )`,
    `CREATE TABLE routines (
       id TEXT PRIMARY KEY NOT NULL,
       name TEXT NOT NULL,
       position INTEGER NOT NULL
     )`,
    `CREATE TABLE routine_exercises (
       id TEXT PRIMARY KEY NOT NULL,
       routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
       exercise_id TEXT NOT NULL,
       sets INTEGER NOT NULL,
       reps TEXT NOT NULL,
       position INTEGER NOT NULL
     )`,
    'CREATE INDEX workouts_started ON workouts(started_at)',
    'CREATE INDEX workout_exercises_workout ON workout_exercises(workout_id)',
    'CREATE INDEX workout_exercises_exercise ON workout_exercises(exercise_id)',
    'CREATE INDEX sets_workout_exercise ON sets(workout_exercise_id)',
    'CREATE INDEX routine_exercises_routine ON routine_exercises(routine_id)',
  ],
];

async function migrateSchema(db: SqlDb) {
  const res = await db.execute('PRAGMA user_version');
  const current = Number(res.rows[0]?.user_version ?? 0);
  for (let v = current; v < SCHEMA.length; v++) {
    await db.transaction(async tx => {
      for (const sql of SCHEMA[v]) await tx.execute(sql);
      await tx.execute(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

/* ─────────────────────────── conversions ─────────────────────────── */

// Weights and reps are strings in the app (so inputs stay editable) but real
// numbers in the database, so they can be summed and compared in SQL.
const toReal = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const toInt = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};
const fromNum = (n: unknown) => (typeof n === 'number' ? String(n) : '');

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);

/**
 * Built-in exercises ship with the app (`default-*` and the `db-*` catalog), so
 * they are not saved — unless archived, which has to survive a restart.
 */
const isBuiltIn = (id: string) => id.startsWith('default-') || id.startsWith('db-');
export const persistedExercises = (exercises: Exercise[]) =>
  exercises.filter(e => !isBuiltIn(e.id) || e.archived);

/** Largest number of bound parameters per statement (SQLite's old limit is 999). */
const MAX_PARAMS = 900;

async function insertRows(
  tx: SqlExecutor,
  table: string,
  columns: string[],
  rows: Param[][],
) {
  const perStatement = Math.max(1, Math.floor(MAX_PARAMS / columns.length));
  const group = `(${columns.map(() => '?').join(',')})`;
  for (let i = 0; i < rows.length; i += perStatement) {
    const chunk = rows.slice(i, i + perStatement);
    await tx.execute(
      `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES ${chunk
        .map(() => group)
        .join(',')}`,
      chunk.flat(),
    );
  }
}

/* ─────────────────────────── writers ─────────────────────────── */

const setMeta = (tx: SqlExecutor, key: string, value: unknown) =>
  tx.execute('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [
    key,
    JSON.stringify(value),
  ]);

const deleteMeta = (tx: SqlExecutor, key: string) =>
  tx.execute('DELETE FROM meta WHERE key = ?', [key]);

const writeJsonMeta = (tx: SqlExecutor, key: string, value: unknown) =>
  value === null || value === undefined
    ? deleteMeta(tx, key)
    : setMeta(tx, key, value);

async function writeExercises(tx: SqlExecutor, list: Exercise[]) {
  await insertRows(
    tx,
    'exercises',
    ['id', 'name', 'muscle', 'archived'],
    list.map(e => [e.id, e.name, e.muscle, e.archived ? 1 : 0]),
  );
}

async function removeWorkout(tx: SqlExecutor, id: string) {
  // Explicit rather than relying on ON DELETE CASCADE, which needs a pragma
  await tx.execute(
    `DELETE FROM sets WHERE workout_exercise_id IN
       (SELECT id FROM workout_exercises WHERE workout_id = ?)`,
    [id],
  );
  await tx.execute('DELETE FROM workout_exercises WHERE workout_id = ?', [id]);
  await tx.execute('DELETE FROM workouts WHERE id = ?', [id]);
}

async function writeWorkout(tx: SqlExecutor, w: Workout) {
  await removeWorkout(tx, w.id);
  await insertRows(
    tx,
    'workouts',
    ['id', 'name', 'started_at', 'finished_at', 'routine_id'],
    [[w.id, w.name, w.startedAt, w.finishedAt ?? null, w.routineId ?? null]],
  );
  await insertRows(
    tx,
    'workout_exercises',
    ['id', 'workout_id', 'exercise_id', 'target_reps', 'position'],
    w.exercises.map((e, i) => [e.id, w.id, e.exerciseId, e.targetReps ?? null, i]),
  );
  await insertRows(
    tx,
    'sets',
    ['id', 'workout_exercise_id', 'position', 'weight', 'reps', 'done'],
    w.exercises.flatMap(e =>
      e.sets.map((s, i) => [
        s.id,
        e.id,
        i,
        toReal(s.weight),
        toInt(s.reps),
        s.done ? 1 : 0,
      ]),
    ),
  );
}

async function writeRoutines(tx: SqlExecutor, routines: Routine[]) {
  await tx.execute('DELETE FROM routine_exercises');
  await tx.execute('DELETE FROM routines');
  await insertRows(
    tx,
    'routines',
    ['id', 'name', 'position'],
    routines.map((r, i) => [r.id, r.name, i]),
  );
  await insertRows(
    tx,
    'routine_exercises',
    ['id', 'routine_id', 'exercise_id', 'sets', 'reps', 'position'],
    routines.flatMap(r =>
      r.exercises.map((e, i) => [e.id, r.id, e.exerciseId, e.sets, e.reps, i]),
    ),
  );
}

/** Writes a whole state, used when importing the old save. */
async function writeAll(tx: SqlExecutor, p: Partial<Persisted>) {
  if (p.exercises) await writeExercises(tx, persistedExercises(p.exercises));
  if (p.routines) await writeRoutines(tx, p.routines);
  // Oldest first, so insertion order matches the order they were done in
  for (const w of [...(p.history ?? [])].reverse()) await writeWorkout(tx, w);
  if (p.restSeconds !== undefined) await setMeta(tx, 'restSeconds', p.restSeconds);
  await writeJsonMeta(tx, 'active', p.active);
  await writeJsonMeta(tx, 'rest', p.rest);
}

/* ─────────────────────────── readers ─────────────────────────── */

function groupBy<T>(rows: Record<string, unknown>[], key: string, make: (r: Record<string, unknown>) => T) {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = text(r[key]);
    const list = out.get(k);
    if (list) list.push(make(r));
    else out.set(k, [make(r)]);
  }
  return out;
}

const parseJson = (value: unknown) => {
  try {
    return typeof value === 'string' ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
};

async function readAll(db: SqlDb): Promise<Partial<Persisted>> {
  const out: Partial<Persisted> = {};

  const meta = new Map<string, unknown>();
  for (const r of (await db.execute('SELECT key, value FROM meta')).rows) {
    meta.set(text(r.key), parseJson(r.value));
  }
  const restSeconds = meta.get('restSeconds');
  if (typeof restSeconds === 'number') out.restSeconds = restSeconds;
  const active = meta.get('active');
  if (active && typeof active === 'object') out.active = active as Workout;
  const rest = meta.get('rest');
  if (rest && typeof rest === 'object') out.rest = rest as State['rest'];

  out.exercises = (
    await db.execute(
      'SELECT id, name, muscle, archived FROM exercises ORDER BY rowid',
    )
  ).rows.map(r => ({
    id: text(r.id),
    name: text(r.name),
    muscle: (MUSCLE_GROUPS as string[]).includes(text(r.muscle))
      ? (text(r.muscle) as MuscleGroup)
      : 'Other',
    ...(r.archived ? { archived: true } : {}),
  }));

  const routineExercises = groupBy<RoutineExercise>(
    (
      await db.execute(
        `SELECT id, routine_id, exercise_id, sets, reps FROM routine_exercises
         ORDER BY routine_id, position`,
      )
    ).rows,
    'routine_id',
    r => ({
      id: text(r.id),
      exerciseId: text(r.exercise_id),
      sets: num(r.sets),
      reps: text(r.reps),
    }),
  );
  out.routines = (
    await db.execute('SELECT id, name FROM routines ORDER BY position')
  ).rows.map(r => ({
    id: text(r.id),
    name: text(r.name),
    exercises: routineExercises.get(text(r.id)) ?? [],
  }));

  const sets = groupBy<WorkoutSet>(
    (
      await db.execute(
        `SELECT id, workout_exercise_id, weight, reps, done FROM sets
         ORDER BY workout_exercise_id, position`,
      )
    ).rows,
    'workout_exercise_id',
    r => ({
      id: text(r.id),
      weight: fromNum(r.weight),
      reps: fromNum(r.reps),
      done: !!r.done,
    }),
  );
  const workoutExercises = groupBy<WorkoutExercise>(
    (
      await db.execute(
        `SELECT id, workout_id, exercise_id, target_reps FROM workout_exercises
         ORDER BY workout_id, position`,
      )
    ).rows,
    'workout_id',
    r => ({
      id: text(r.id),
      exerciseId: text(r.exercise_id),
      ...(typeof r.target_reps === 'string' ? { targetReps: r.target_reps } : {}),
      sets: sets.get(text(r.id)) ?? [],
    }),
  );
  // Newest first, like the in-memory history
  out.history = (
    await db.execute(
      `SELECT id, name, started_at, finished_at, routine_id FROM workouts
       ORDER BY started_at DESC, rowid DESC`,
    )
  ).rows.map(r => ({
    id: text(r.id),
    name: text(r.name),
    startedAt: num(r.started_at),
    ...(typeof r.finished_at === 'number' ? { finishedAt: r.finished_at } : {}),
    ...(typeof r.routine_id === 'string' ? { routineId: r.routine_id } : {}),
    exercises: workoutExercises.get(text(r.id)) ?? [],
  }));

  return out;
}

/* ─────────────────────── the old AsyncStorage save ─────────────────────── */

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter(isObject) : [];
const finite = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const idOf = (v: unknown) => (typeof v === 'string' && v ? v : uid());

function coerceWorkout(r: Record<string, unknown>): Workout {
  return {
    id: idOf(r.id),
    name: text(r.name) || 'Workout',
    startedAt: finite(r.startedAt, 0),
    ...(typeof r.finishedAt === 'number' ? { finishedAt: r.finishedAt } : {}),
    ...(typeof r.routineId === 'string' ? { routineId: r.routineId } : {}),
    exercises: list(r.exercises).map(e => ({
      id: idOf(e.id),
      exerciseId: text(e.exerciseId),
      ...(typeof e.targetReps === 'string' ? { targetReps: e.targetReps } : {}),
      sets: list(e.sets).map(s => ({
        id: idOf(s.id),
        weight: text(s.weight),
        reps: text(s.reps),
        done: !!s.done,
      })),
    })),
  };
}

/**
 * Turns whatever the old save contained into well-formed data, dropping what
 * can't be understood, so one damaged record can't block the whole import.
 */
export function coerceLegacy(raw: unknown): Partial<Persisted> {
  if (!isObject(raw)) return {};
  const out: Partial<Persisted> = {};
  out.exercises = list(raw.exercises)
    .filter(e => typeof e.id === 'string' && typeof e.name === 'string')
    .map(e => ({
      id: e.id as string,
      name: e.name as string,
      muscle: (MUSCLE_GROUPS as string[]).includes(text(e.muscle))
        ? (e.muscle as MuscleGroup)
        : 'Other',
      ...(e.archived ? { archived: true } : {}),
    }));
  out.history = list(raw.history).map(coerceWorkout);
  out.routines = list(raw.routines).map(r => ({
    id: idOf(r.id),
    name: text(r.name) || 'Day',
    exercises: list(r.exercises).map(e => ({
      id: idOf(e.id),
      exerciseId: text(e.exerciseId),
      sets: finite(e.sets, 3),
      reps: text(e.reps),
    })),
  }));
  if (isObject(raw.active)) out.active = coerceWorkout(raw.active);
  if (typeof raw.restSeconds === 'number') out.restSeconds = raw.restSeconds;
  if (
    isObject(raw.rest) &&
    typeof raw.rest.endsAt === 'number' &&
    typeof raw.rest.total === 'number'
  ) {
    out.rest = { endsAt: raw.rest.endsAt, total: raw.rest.total };
  }
  return out;
}

/* ───────────────────────────── the store ───────────────────────────── */

export async function createDataStore(db: SqlDb): Promise<DataStore> {
  await migrateSchema(db);

  return {
    async needsLegacyImport() {
      const res = await db.execute(
        "SELECT 1 AS found FROM meta WHERE key = 'legacy_import'",
      );
      return res.rows.length === 0;
    },

    async importLegacy(raw) {
      let status = 'none';
      let data: Partial<Persisted> = {};
      if (raw !== null) {
        try {
          data = coerceLegacy(JSON.parse(raw));
          status = 'imported';
        } catch {
          status = 'unreadable';
        }
      }
      // Data and the "done" marker commit together: an interrupted import is
      // rolled back and simply runs again on the next launch.
      await db.transaction(async tx => {
        await writeAll(tx, data);
        await setMeta(tx, 'legacy_import', status);
      });
    },

    load: () => readAll(db),

    async save(prev, next) {
      await db.transaction(async tx => {
        if (next.restSeconds !== prev.restSeconds) {
          await setMeta(tx, 'restSeconds', next.restSeconds);
        }
        if (next.active !== prev.active) {
          await writeJsonMeta(tx, 'active', next.active);
        }
        if (next.rest !== prev.rest) {
          await writeJsonMeta(tx, 'rest', next.rest);
        }

        if (next.exercises !== prev.exercises) {
          const before = new Map(prev.exercises.map(e => [e.id, e]));
          await writeExercises(
            tx,
            persistedExercises(next.exercises).filter(
              e => before.get(e.id) !== e,
            ),
          );
        }

        if (next.history !== prev.history) {
          const before = new Map(prev.history.map(w => [w.id, w]));
          const after = new Set(next.history.map(w => w.id));
          for (const id of before.keys()) {
            if (!after.has(id)) await removeWorkout(tx, id);
          }
          // Oldest first so new rows keep the order the workouts happened in
          for (const w of [...next.history].reverse()) {
            if (before.get(w.id) !== w) await writeWorkout(tx, w);
          }
        }

        if (next.routines !== prev.routines) {
          await writeRoutines(tx, next.routines);
        }
      });
    },
  };
}
