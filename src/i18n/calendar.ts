import type { Lang } from './types';

interface CalendarNames {
  /** Sunday first, matching `Date#getDay()`. */
  weekdays: string[];
  months: string[];
  /** One-letter day names starting on Monday, for the week strip. */
  dayInitials: string[];
}

// Written out by hand instead of using Intl: Hermes ships only part of Intl,
// and the Arabic locale would otherwise default to Arabic-Indic digits.
export const CALENDAR: Record<Lang, CalendarNames> = {
  en: {
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    dayInitials: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  },
  ar: {
    weekdays: [
      'الأحد',
      'الاثنين',
      'الثلاثاء',
      'الأربعاء',
      'الخميس',
      'الجمعة',
      'السبت',
    ],
    months: [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ],
    dayInitials: ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'],
  },
};
