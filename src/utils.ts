import { Workout, WorkoutSet } from './types';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Copy of `list` with the item at `from` moved to index `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

/** Which slot of a `count`-long vertical list a row dragged to `top` sits in. */
export const slotAt = (top: number, step: number, count: number) =>
  Math.max(0, Math.min(count - 1, Math.round(top / step)));

export const setVolume = (s: WorkoutSet) =>
  (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0);

export const workoutVolume = (w: Workout) =>
  w.exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.filter(s => s.done).reduce((a, s) => a + setVolume(s), 0),
    0,
  );

export const completedSets = (w: Workout) =>
  w.exercises.reduce((n, ex) => n + ex.sets.filter(s => s.done).length, 0);

export const formatTimer = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/** Monday-based start of the week containing `ts`. */
export const startOfWeek = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Estimated one-rep max (Epley). */
export const e1rm = (weight: number, reps: number) =>
  reps <= 0 ? 0 : reps === 1 ? weight : weight * (1 + reps / 30);

/**
 * Arabic-Indic (٠–٩) and Persian (۰–۹) digits → 0–9, and the Arabic decimal
 * separator (٫) and comma (،) → ".". Some keyboards type these in Arabic mode.
 */
export const toAsciiDigits = (t: string) =>
  t
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u066B\u060C]/g, '.')
    .replace(/\u066C/g, '');

/** Keeps digits and a single decimal point; accepts "," as the separator. */
export const sanitizeWeight = (t: string) => {
  const [int, ...rest] = toAsciiDigits(t)
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '')
    .split('.');
  return rest.length ? `${int}.${rest.join('')}` : int;
};

/** Keeps only digits (reps), accepting Arabic-Indic digits too. */
export const sanitizeReps = (t: string) => toAsciiDigits(t).replace(/\D/g, '');

/** Keeps digits and "-" for a rep target such as "8-12". */
export const sanitizeRepRange = (t: string) =>
  toAsciiDigits(t).replace(/[^\d-]/g, '');

const topWeight = (sets: WorkoutSet[]) =>
  Math.max(0, ...sets.map(s => parseFloat(s.weight) || 0));

/**
 * PR count per workout id: exercises whose top weight beat every earlier
 * workout. One pass over history (which is stored newest first).
 */
export const prCounts = (history: Workout[]) => {
  const best: Record<string, number> = {};
  const out: Record<string, number> = {};
  for (let i = history.length - 1; i >= 0; i--) {
    const w = history[i];
    let n = 0;
    const tops: [string, number][] = w.exercises.map(e => [
      e.exerciseId,
      topWeight(e.sets),
    ]);
    for (const [id, top] of tops) {
      if ((best[id] ?? 0) > 0 && top > best[id]) n++;
    }
    for (const [id, top] of tops) best[id] = Math.max(best[id] ?? 0, top);
    out[w.id] = n;
  }
  return out;
};
