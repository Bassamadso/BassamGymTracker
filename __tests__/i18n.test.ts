import { ar } from '../src/i18n/ar';
import {
  createI18n,
  groupDigits,
  normalizeSearch,
  pluralCategory,
  translate,
} from '../src/i18n/core';
import { en, MessageKey } from '../src/i18n/en';
import { EXERCISE_NAMES_AR } from '../src/i18n/exerciseNames.ar';
import { Message } from '../src/i18n/types';
import { buildPlan, SPLITS } from '../src/plans';
import { initialState } from '../src/store';
import {
  sanitizeRepRange,
  sanitizeReps,
  sanitizeWeight,
  toAsciiDigits,
} from '../src/utils';

const keys = Object.keys(en) as MessageKey[];
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
const forms = (m: Message) => (typeof m === 'string' ? [m] : Object.values(m));

describe('dictionaries', () => {
  test('Arabic defines every English key, and nothing else', () => {
    expect(Object.keys(ar).sort()).toEqual([...keys].sort());
  });

  test('both languages use the same placeholders for each message', () => {
    for (const key of keys) {
      const enForms = en[key] as Message;
      const arForms = ar[key];
      // Plural forms may drop {count} ("one" → "تمرين واحد") but never add names
      const allowed = new Set(forms(enForms).flatMap(placeholders));
      for (const form of forms(arForms)) {
        for (const name of placeholders(form)) {
          expect([key, allowed.has(name)]).toEqual([key, true]);
        }
      }
      if (typeof enForms === 'string') {
        expect([key, placeholders(arForms as string)]).toEqual([
          key,
          placeholders(enForms),
        ]);
      }
    }
  });

  test('plural messages in both languages are keyed by count and complete', () => {
    for (const key of keys) {
      const e = en[key] as Message;
      const a = ar[key];
      expect([key, typeof e === 'string']).toEqual([
        key,
        typeof a === 'string',
      ]);
      if (typeof a !== 'string') {
        expect(a.other).toBeTruthy();
        // Arabic spells out the forms people actually see for 3–10 and 11–99
        expect([key, !!a.few, !!a.many, !!a.two, !!a.one]).toEqual([
          key,
          true,
          true,
          true,
          true,
        ]);
      }
    }
  });

  test('Arabic strings use Western digits only, like the app UI', () => {
    const text = [
      ...keys.flatMap(k => forms(ar[k])),
      ...Object.values(EXERCISE_NAMES_AR),
    ].join('');
    expect(text).not.toMatch(/[٠-٩۰-۹]/);
  });
});

describe('plurals', () => {
  test('English: 1 is singular, everything else plural', () => {
    expect([0, 1, 2, 5].map(n => pluralCategory('en', n))).toEqual([
      'other',
      'one',
      'other',
      'other',
    ]);
  });

  test('Arabic follows the CLDR six-form rules', () => {
    const cat = (n: number) => pluralCategory('ar', n);
    expect([0, 1, 2].map(cat)).toEqual(['zero', 'one', 'two']);
    expect([3, 10, 103, 110].map(cat)).toEqual(['few', 'few', 'few', 'few']);
    expect([11, 99, 111, 199].map(cat)).toEqual([
      'many',
      'many',
      'many',
      'many',
    ]);
    expect([100, 101, 102, 200, 1.5].map(cat)).toEqual(Array(5).fill('other'));
  });

  test('picks the right sentence for a count', () => {
    expect(translate('en', 'count.set', { count: 1 })).toBe('1 set');
    expect(translate('en', 'count.set', { count: 4 })).toBe('4 sets');
    const sets = (n: number) => translate('ar', 'count.set', { count: n });
    expect(sets(1)).toBe('مجموعة واحدة');
    expect(sets(2)).toBe('مجموعتان');
    expect(sets(4)).toBe('4 مجموعات');
    expect(sets(12)).toBe('12 مجموعة');
  });

  test('fills placeholders and leaves unknown ones alone', () => {
    expect(translate('en', 'home.startDay', { name: 'PUSH' })).toBe(
      'START PUSH',
    );
    expect(translate('ar', 'home.startDay', { name: 'دفع' })).toBe('ابدأ دفع');
    expect(translate('en', 'home.startDay')).toBe('START {name}');
  });
});

describe('formatting', () => {
  // Wednesday 12 November 2025, 14:30 local time
  const ts = new Date(2025, 10, 12, 14, 30).getTime();
  const en_ = createI18n('en', false);
  const ar_ = createI18n('ar', true);

  test('dates', () => {
    expect(en_.formatDate(ts)).toBe('Wed, Nov 12');
    expect(ar_.formatDate(ts)).toBe('الأربعاء، 12 نوفمبر');
    expect(en_.formatDateShort(ts)).toBe('11/12');
    expect(ar_.formatDateShort(ts)).toBe('12/11');
    expect(en_.monthShort(ts)).toBe('Nov');
    expect(ar_.monthShort(ts)).toBe('نوفمبر');
  });

  test('week strip initials start on Monday in both languages', () => {
    expect(en_.dayInitials).toHaveLength(7);
    expect(ar_.dayInitials).toEqual(['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح']);
  });

  test('durations, weights and greetings', () => {
    expect(en_.formatDuration(65 * 60000)).toBe('1h 5m');
    expect(en_.formatDuration(5 * 60000)).toBe('5m');
    expect(ar_.formatDuration(65 * 60000)).toBe('1 س 5 د');
    expect(en_.formatKg(1440)).toBe('1,440 kg');
    expect(ar_.formatKg(1440)).toBe('1,440 كجم');
    expect(en_.formatKg(12345)).toBe('12.3 t');
    expect(groupDigits(1234567)).toBe('1,234,567');
    expect(en_.greeting(9)).toBe('Good morning');
    expect(ar_.greeting(9)).toBe('صباح الخير');
    expect(ar_.greeting(20)).toBe('مساء الخير');
    expect(en_.workoutName(9)).toBe('Morning Workout');
    expect(ar_.workoutName(14)).toBe('تمرين بعد الظهر');
  });

  test('signed numbers keep their order only inside right-to-left text', () => {
    expect(en_.ltr('+5')).toBe('+5');
    expect(ar_.ltr('+5')).toBe('\u2066+5\u2069');
  });
});

describe('exercise names', () => {
  const exercises = initialState.exercises;
  const arabic = createI18n('ar', true);
  const english = createI18n('en', false);

  test('every built-in exercise has an Arabic name', () => {
    const missing = exercises.filter(e => !EXERCISE_NAMES_AR[e.id]);
    expect(missing.map(e => `${e.id} (${e.name})`)).toEqual([]);
  });

  test('no Arabic name is just the English one left in place', () => {
    const same = exercises.filter(e => EXERCISE_NAMES_AR[e.id] === e.name);
    expect(same.map(e => e.name)).toEqual([]);
  });

  test('two exercises in the library never share an Arabic name', () => {
    const byName = new Map<string, string[]>();
    for (const e of exercises) {
      const name = arabic.exerciseName(e);
      byName.set(name, [...(byName.get(name) ?? []), e.name]);
    }
    const clashes = [...byName].filter(([, list]) => list.length > 1);
    expect(clashes).toEqual([]);
  });

  test('custom exercises keep the name the user typed', () => {
    const custom = { id: 'abc123', name: 'My Cable Thing', muscle: 'Back' };
    expect(arabic.exerciseName(custom)).toBe('My Cable Thing');
    expect(arabic.exerciseName({ id: 'abc124', name: 'سكوات خاص' })).toBe(
      'سكوات خاص',
    );
  });

  test('English never uses the Arabic names', () => {
    expect(english.exerciseName(exercises[0])).toBe('Bench Press');
    expect(arabic.exerciseName(exercises[0])).toBe('ضغط البنش');
  });

  test('muscle groups are translated, not shown as stored ids', () => {
    expect(arabic.muscleName('Chest')).toBe('الصدر');
    expect(english.muscleName('Chest')).toBe('Chest');
  });
});

describe('search', () => {
  const arabic = createI18n('ar', true);
  const bench = initialState.exercises[0];

  test('finds an exercise by its Arabic or English name', () => {
    expect(arabic.matchesSearch(bench, 'ضغط')).toBe(true);
    expect(arabic.matchesSearch(bench, 'bench')).toBe(true);
    expect(arabic.matchesSearch(bench, 'سكوات')).toBe(false);
    expect(arabic.matchesSearch(bench, '   ')).toBe(true);
  });

  test('ignores hamza, ta marbuta, diacritics and tatweel', () => {
    expect(normalizeSearch('أَرجُل')).toBe(normalizeSearch('ارجل'));
    expect(normalizeSearch('المكتبة')).toBe(normalizeSearch('المكتبه'));
    expect(normalizeSearch('ضغـــط')).toBe('ضغط');
  });

  test('orders Arabic names alphabetically', () => {
    const sorted = ['ب', 'أ', 'ت'].sort(arabic.compare);
    expect(sorted).toEqual(['أ', 'ب', 'ت']);
  });
});

describe('number input from an Arabic keyboard', () => {
  test('Arabic-Indic and Persian digits become 0–9', () => {
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  test('weight accepts the Arabic decimal separator and comma', () => {
    expect(sanitizeWeight('٦٢٫٥')).toBe('62.5');
    expect(sanitizeWeight('٦٢،٥')).toBe('62.5');
    expect(sanitizeWeight('62,5')).toBe('62.5');
  });

  test('reps and rep ranges accept Arabic digits too', () => {
    expect(sanitizeReps('١٢')).toBe('12');
    expect(sanitizeReps('1a2')).toBe('12');
    expect(sanitizeRepRange('٨-١٢')).toBe('8-12');
  });
});

describe('weekly plan in Arabic', () => {
  const arabic = createI18n('ar', true);

  test('names the days in Arabic but still finds the exercises', () => {
    const plan = buildPlan(SPLITS[0], initialState.exercises, arabic.t);
    expect(plan.map(r => r.name)).toEqual(['دفع', 'سحب', 'أرجل']);
    // Matching is by English name, so Arabic days are not empty
    plan.forEach(r => expect(r.exercises.length).toBeGreaterThan(0));
    expect(
      buildPlan({ days: 4 }, initialState.exercises, arabic.t)[3].name,
    ).toBe('اليوم 4');
  });

  test('every split has a title and description in both languages', () => {
    for (const split of SPLITS) {
      for (const key of [split.titleKey, split.descriptionKey]) {
        expect(translate('en', key)).toBeTruthy();
        expect(translate('ar', key)).not.toBe(translate('en', key));
      }
    }
  });
});
