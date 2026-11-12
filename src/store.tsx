import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import { EXERCISE_CATALOG } from './exerciseCatalog';
import { bottomOfRange } from './plans';
import { Exercise, MuscleGroup, Routine, Workout, WorkoutSet } from './types';
import { uid } from './utils';

const STORAGE_KEY = 'gymtracker:v1';

const DEFAULT_EXERCISES: Exercise[] = [
  ['Bench Press', 'Chest'],
  ['Incline Dumbbell Press', 'Chest'],
  ['Chest Fly', 'Chest'],
  ['Push-up', 'Chest'],
  ['Deadlift', 'Back'],
  ['Pull-up', 'Back'],
  ['Barbell Row', 'Back'],
  ['Lat Pulldown', 'Back'],
  ['Seated Cable Row', 'Back'],
  ['Squat', 'Legs'],
  ['Leg Press', 'Legs'],
  ['Romanian Deadlift', 'Legs'],
  ['Lunge', 'Legs'],
  ['Leg Curl', 'Legs'],
  ['Calf Raise', 'Legs'],
  ['Overhead Press', 'Shoulders'],
  ['Lateral Raise', 'Shoulders'],
  ['Face Pull', 'Shoulders'],
  ['Barbell Curl', 'Arms'],
  ['Hammer Curl', 'Arms'],
  ['Tricep Pushdown', 'Arms'],
  ['Skull Crusher', 'Arms'],
  ['Plank', 'Core'],
  ['Hanging Leg Raise', 'Core'],
  ['Cable Crunch', 'Core'],
].map(([name, muscle], i) => ({
  id: `default-${i}`,
  name,
  muscle: muscle as MuscleGroup,
}));

/** "Pull-up", "Pullups" and "pull ups" all compare equal. */
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, '');

/**
 * Adds the bundled exercise catalog to a library. Anything whose id or name is
 * already there (including archived exercises) is skipped, so custom exercises
 * aren't duplicated and deleted ones don't come back.
 */
export function withCatalog(exercises: Exercise[]): Exercise[] {
  const ids = new Set(exercises.map(e => e.id));
  const names = new Set(exercises.map(e => nameKey(e.name)));
  const added: Exercise[] = [];
  for (const [id, name, muscle] of EXERCISE_CATALOG) {
    if (ids.has(id) || names.has(nameKey(name))) continue;
    added.push({ id, name, muscle });
  }
  return added.length ? [...exercises, ...added] : exercises;
}

export interface State {
  loaded: boolean;
  exercises: Exercise[];
  history: Workout[]; // newest first
  active: Workout | null;
  restSeconds: number; // default rest between sets
  routines: Routine[]; // weekly plan, one per training day
  rest: { endsAt: number; total: number } | null; // running rest timer
}

/** Fields written to storage. */
const PERSISTED = [
  'exercises',
  'history',
  'active',
  'restSeconds',
  'routines',
  'rest',
] as const;

type Action =
  | { type: 'load'; payload: Partial<State> }
  | { type: 'addExercise'; exercise: Exercise }
  | { type: 'deleteExercise'; id: string }
  | { type: 'startWorkout' }
  | { type: 'renameWorkout'; name: string }
  | { type: 'addToWorkout'; exerciseIds: string[] }
  | { type: 'removeFromWorkout'; workoutExerciseId: string }
  | { type: 'reorderWorkout'; workoutExerciseIds: string[] }
  | { type: 'addSet'; workoutExerciseId: string }
  | { type: 'removeSet'; workoutExerciseId: string; setId: string }
  | {
      type: 'updateSet';
      workoutExerciseId: string;
      setId: string;
      patch: Partial<WorkoutSet>;
    }
  | { type: 'finishWorkout' }
  | { type: 'discardWorkout' }
  | { type: 'deleteWorkout'; id: string }
  | { type: 'setRestSeconds'; seconds: number }
  | { type: 'startRest' }
  | { type: 'adjustRest'; endsAt: number }
  | { type: 'stopRest' }
  | { type: 'setPlan'; routines: Routine[] }
  | { type: 'saveRoutine'; routine: Routine }
  | { type: 'deleteRoutine'; id: string }
  | { type: 'startRoutine'; id: string };

export const initialState: State = {
  loaded: false,
  exercises: withCatalog(DEFAULT_EXERCISES),
  history: [],
  active: null,
  restSeconds: 90,
  routines: [],
  rest: null,
};

const newSet = (prev?: WorkoutSet): WorkoutSet => ({
  id: uid(),
  weight: prev?.weight ?? '',
  reps: prev?.reps ?? '',
  done: false,
});

function updateActive(state: State, fn: (w: Workout) => Workout): State {
  return state.active ? { ...state, active: fn(state.active) } : state;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return { ...state, ...action.payload, loaded: true };

    case 'addExercise':
      return { ...state, exercises: [...state.exercises, action.exercise] };

    case 'deleteExercise':
      // Archive instead of removing so history and plans keep the name
      return {
        ...state,
        exercises: state.exercises.map(e =>
          e.id === action.id ? { ...e, archived: true } : e,
        ),
      };

    case 'startWorkout': {
      const hour = new Date().getHours();
      const part = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
      return {
        ...state,
        active: {
          id: uid(),
          name: `${part} Workout`,
          startedAt: Date.now(),
          exercises: [],
        },
      };
    }

    case 'renameWorkout':
      return updateActive(state, w => ({ ...w, name: action.name }));

    case 'addToWorkout':
      return updateActive(state, w => ({
        ...w,
        exercises: [
          ...w.exercises,
          ...action.exerciseIds.map(exerciseId => {
            // Pre-fill the first set with the last logged values for this exercise
            const last = lastSetsFor(state.history, exerciseId);
            return {
              id: uid(),
              exerciseId,
              sets: last.length ? last.map(s => newSet(s)) : [newSet()],
            };
          }),
        ],
      }));

    case 'removeFromWorkout':
      return updateActive(state, w => ({
        ...w,
        exercises: w.exercises.filter(e => e.id !== action.workoutExerciseId),
      }));

    case 'reorderWorkout':
      return updateActive(state, w => {
        // Unknown ids are ignored; exercises not listed keep their order at the end
        const rank = new Map(action.workoutExerciseIds.map((id, i) => [id, i]));
        const missing = action.workoutExerciseIds.length;
        return {
          ...w,
          exercises: [...w.exercises].sort(
            (a, b) => (rank.get(a.id) ?? missing) - (rank.get(b.id) ?? missing),
          ),
        };
      });

    case 'addSet':
      return updateActive(state, w => ({
        ...w,
        exercises: w.exercises.map(e =>
          e.id === action.workoutExerciseId
            ? { ...e, sets: [...e.sets, newSet(e.sets[e.sets.length - 1])] }
            : e,
        ),
      }));

    case 'removeSet':
      return updateActive(state, w => ({
        ...w,
        exercises: w.exercises.map(e =>
          e.id === action.workoutExerciseId
            ? { ...e, sets: e.sets.filter(s => s.id !== action.setId) }
            : e,
        ),
      }));

    case 'updateSet':
      return updateActive(state, w => ({
        ...w,
        exercises: w.exercises.map(e =>
          e.id === action.workoutExerciseId
            ? {
                ...e,
                sets: e.sets.map(s =>
                  s.id === action.setId ? { ...s, ...action.patch } : s,
                ),
              }
            : e,
        ),
      }));

    case 'finishWorkout': {
      if (!state.active) return state;
      // Keep only completed sets; drop exercises with none
      const exercises = state.active.exercises
        .map(e => ({ ...e, sets: e.sets.filter(s => s.done) }))
        .filter(e => e.sets.length > 0);
      if (exercises.length === 0) return { ...state, active: null, rest: null };
      const finished: Workout = {
        ...state.active,
        exercises,
        finishedAt: Date.now(),
      };
      return {
        ...state,
        active: null,
        rest: null,
        history: [finished, ...state.history],
      };
    }

    case 'discardWorkout':
      return { ...state, active: null, rest: null };

    case 'deleteWorkout':
      return {
        ...state,
        history: state.history.filter(w => w.id !== action.id),
      };

    case 'setRestSeconds':
      return {
        ...state,
        restSeconds: Math.min(600, Math.max(15, action.seconds)),
      };

    case 'startRest':
      return {
        ...state,
        rest: {
          endsAt: Date.now() + state.restSeconds * 1000,
          total: state.restSeconds,
        },
      };

    case 'adjustRest':
      return state.rest
        ? { ...state, rest: { ...state.rest, endsAt: action.endsAt } }
        : state;

    case 'stopRest':
      return { ...state, rest: null };

    case 'setPlan':
      return { ...state, routines: action.routines };

    case 'saveRoutine': {
      const exists = state.routines.some(r => r.id === action.routine.id);
      return {
        ...state,
        routines: exists
          ? state.routines.map(r =>
              r.id === action.routine.id ? action.routine : r,
            )
          : [...state.routines, action.routine],
      };
    }

    case 'deleteRoutine':
      return {
        ...state,
        routines: state.routines.filter(r => r.id !== action.id),
      };

    case 'startRoutine': {
      const routine = state.routines.find(r => r.id === action.id);
      if (!routine) return state;
      return {
        ...state,
        rest: null,
        active: {
          id: uid(),
          name: routine.name,
          routineId: routine.id,
          startedAt: Date.now(),
          exercises: routine.exercises.map(re => {
            // Start from what was lifted last time so the user can beat it
            const last = lastSetsFor(state.history, re.exerciseId);
            const sets = Array.from(
              { length: Math.max(1, re.sets) },
              (_, i) => {
                const prev = last[i] ?? last[last.length - 1];
                return newSet(
                  prev ?? {
                    id: '',
                    weight: '',
                    reps: bottomOfRange(re.reps)
                      ? String(bottomOfRange(re.reps))
                      : '',
                    done: false,
                  },
                );
              },
            );
            return {
              id: uid(),
              exerciseId: re.exerciseId,
              targetReps: re.reps,
              sets,
            };
          }),
        },
      };
    }
  }
}

/** Fills in missing/invalid fields so old or damaged saves can't crash the app. */
export function sanitize(raw: unknown): Partial<State> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<State> = {};
  if (Array.isArray(r.exercises) && r.exercises.length) {
    // Existing installs pick up the catalog here, without losing their own
    out.exercises = withCatalog(r.exercises as Exercise[]);
  }
  if (Array.isArray(r.history)) out.history = r.history as Workout[];
  if (Array.isArray(r.routines)) out.routines = r.routines as Routine[];
  if (r.active && typeof r.active === 'object') {
    out.active = r.active as Workout;
  }
  if (typeof r.restSeconds === 'number') out.restSeconds = r.restSeconds;
  if (r.rest && typeof r.rest === 'object') out.rest = r.rest as State['rest'];
  return out;
}

/** Sets logged for an exercise in the most recent workout that included it. */
export function lastSetsFor(history: Workout[], exerciseId: string) {
  for (const w of history) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    if (ex) return ex.sets;
  }
  return [];
}

/** Heaviest weight ever logged for an exercise across finished workouts. */
export function bestWeightFor(history: Workout[], exerciseId: string) {
  let best = 0;
  for (const w of history) {
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) best = Math.max(best, parseFloat(s.weight) || 0);
    }
  }
  return best;
}

interface Store {
  state: State;
  dispatch: React.Dispatch<Action>;
  exerciseById: (id: string) => Exercise | undefined;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Never overwrite storage if we couldn't read it — that would wipe real data
  const canPersist = useRef(true);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        let payload: Partial<State> = {};
        if (raw) {
          try {
            payload = sanitize(JSON.parse(raw));
          } catch {
            // Keep a copy of the unreadable save before starting fresh
            AsyncStorage.setItem(
              `${STORAGE_KEY}:corrupt:${Date.now()}`,
              raw,
            ).catch(() => {});
          }
        }
        dispatch({ type: 'load', payload });
      })
      .catch(() => {
        canPersist.current = false;
        dispatch({ type: 'load', payload: {} });
      });
  }, []);

  const flush = useCallback(() => {
    if (pending.current === null || !canPersist.current) return;
    const json = pending.current;
    pending.current = null;
    AsyncStorage.setItem(STORAGE_KEY, json).catch(() => {});
  }, []);

  // Debounced so typing in set inputs doesn't serialize everything per key
  useEffect(() => {
    if (!state.loaded) return;
    const data: Record<string, unknown> = {};
    for (const k of PERSISTED) data[k] = state[k];
    pending.current = JSON.stringify(data);
    const t = setTimeout(flush, 400);
    return () => clearTimeout(t);
  }, [state, flush]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  const exerciseById = useCallback(
    (id: string) => state.exercises.find(e => e.id === id),
    [state.exercises],
  );

  const value = useMemo(
    () => ({ state, dispatch, exerciseById }),
    [state, exerciseById],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
