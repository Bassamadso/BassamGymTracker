import { ar } from './ar';
import { CALENDAR } from './calendar';
import { en, MessageKey } from './en';
import { EXERCISE_NAMES_AR } from './exerciseNames.ar';
import type { Lang, Message, Params, PluralCategory } from './types';

export type Translate = (key: MessageKey, params?: Params) => string;

const DICTIONARIES: Record<Lang, Record<MessageKey, Message>> = { en, ar };

/**
 * Which plural form a count takes (CLDR rules). Hermes has no
 * `Intl.PluralRules`, and Arabic needs all six forms, so this is spelled out.
 */
export function pluralCategory(lang: Lang, n: number): PluralCategory {
  if (lang === 'ar') {
    if (!Number.isInteger(n)) return 'other';
    if (n === 0) return 'zero';
    if (n === 1) return 'one';
    if (n === 2) return 'two';
    const rest = n % 100;
    if (rest >= 3 && rest <= 10) return 'few';
    if (rest >= 11) return 'many';
    return 'other';
  }
  return n === 1 ? 'one' : 'other';
}

/** Looks up `key`, picks the plural form for `params.count`, fills `{placeholders}`. */
export function translate(lang: Lang, key: MessageKey, params?: Params) {
  const message = DICTIONARIES[lang][key] ?? en[key];
  const raw =
    typeof message === 'string'
      ? message
      : message[pluralCategory(lang, Number(params?.count))] ?? message.other;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** 1440 → "1,440". Always Western digits, in both languages. */
export const groupDigits = (n: number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// Bidi isolate marks: keep a sign or range in reading order inside RTL text.
const LRI = '\u2066';
const PDI = '\u2069';

/** Letters Arabic users type without: hamza forms, ta marbuta, diacritics. */
export function normalizeSearch(text: string) {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // diacritics, dagger alef, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

interface Named {
  id: string;
  name: string;
}

/**
 * Everything the UI needs to speak one language. Pure, so it can be tested
 * without React; `useI18n` memoizes one per language.
 */
export function createI18n(lang: Lang, isRTL: boolean) {
  const t: Translate = (key, params) => translate(lang, key, params);
  const calendar = CALENDAR[lang];

  /** Built-in exercises have a translation by id; custom ones show as typed. */
  const exerciseName = (exercise: Named) =>
    (lang === 'ar' ? EXERCISE_NAMES_AR[exercise.id] : undefined) ??
    exercise.name;

  return {
    lang,
    isRTL,
    t,

    exerciseName,
    /** Muscle groups are stored as English ids ("Chest"); this is the label. */
    muscleName: (muscle: string) => t(`muscle.${muscle}` as MessageKey),

    /** "Wed, Nov 12" / "الأربعاء، 12 نوفمبر" */
    formatDate: (ts: number) => {
      const d = new Date(ts);
      return t('date.long', {
        weekday: calendar.weekdays[d.getDay()],
        month: calendar.months[d.getMonth()],
        day: d.getDate(),
      });
    },
    /** "11/12" / "12/11" — compact label for chart axes. */
    formatDateShort: (ts: number) => {
      const d = new Date(ts);
      return t('date.short', { month: d.getMonth() + 1, day: d.getDate() });
    },
    monthShort: (ts: number) => calendar.months[new Date(ts).getMonth()],
    dayInitials: calendar.dayInitials,

    formatDuration: (ms: number) => {
      const totalMin = Math.max(0, Math.floor(ms / 60000));
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return h > 0 ? t('duration.hm', { h, m }) : t('duration.m', { m });
    },
    /** "1,440 kg", or tonnes for big totals. */
    formatKg: (kg: number) =>
      kg >= 10000
        ? `${(kg / 1000).toFixed(1)} ${t('unit.tonne')}`
        : `${groupDigits(Math.round(kg))} ${t('unit.kg')}`,

    greeting: (hour = new Date().getHours()) =>
      t(
        hour < 12
          ? 'greeting.morning'
          : hour < 17
          ? 'greeting.afternoon'
          : 'greeting.evening',
      ),
    /** Default name for an ad-hoc workout, e.g. "Morning Workout". */
    workoutName: (hour = new Date().getHours()) =>
      t(
        hour < 12
          ? 'workout.nameMorning'
          : hour < 17
          ? 'workout.nameAfternoon'
          : 'workout.nameEvening',
      ),

    /** Alphabetical order for the language (falls back to code-unit order). */
    compare: (a: string, b: string) => a.localeCompare(b, lang),
    /** Whether an exercise matches a search, by its shown or English name. */
    matchesSearch: (exercise: Named, query: string) => {
      const q = normalizeSearch(query);
      return (
        !q ||
        normalizeSearch(exerciseName(exercise)).includes(q) ||
        normalizeSearch(exercise.name).includes(q)
      );
    },

    /** Keeps a sign/number token in reading order inside right-to-left text. */
    ltr: (text: string) => (isRTL ? `${LRI}${text}${PDI}` : text),
  };
}

export type I18n = ReturnType<typeof createI18n>;
