export type Lang = 'en' | 'ar';

export const LANGUAGES: Lang[] = ['en', 'ar'];

/** Each language's own name, shown on the switcher so it's readable in any UI language. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  ar: 'العربية',
};

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** A message that depends on a `count` param. `other` is the required fallback. */
export type PluralMessage = Partial<Record<PluralCategory, string>> & {
  other: string;
};

export type Message = string | PluralMessage;

export type Params = Record<string, string | number>;
