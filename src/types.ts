export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Shoulders'
  | 'Arms'
  | 'Core'
  | 'Other';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Other',
];

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  /** Hidden from the library but kept so past workouts still show its name. */
  archived?: boolean;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string; // target, e.g. "8" or "8-12"
}

/** One training day of a weekly plan, e.g. "Push". */
export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
}

export interface WorkoutSet {
  id: string;
  weight: string; // kept as string so inputs stay editable ("", "62.5")
  reps: string;
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  targetReps?: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  finishedAt?: number;
  routineId?: string;
  exercises: WorkoutExercise[];
}
