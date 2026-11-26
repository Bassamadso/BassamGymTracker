import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  DevSettings,
  I18nManager,
  Platform,
  Settings,
} from 'react-native';
import { createI18n, I18n, translate } from './core';
import type { Lang } from './types';

export { LANGUAGE_NAMES, LANGUAGES } from './types';
export type { Lang } from './types';

const STORAGE_KEY = 'gymtracker:lang';

const asLang = (value: unknown): Lang | null => {
  const code =
    typeof value === 'string' ? value.toLowerCase().split(/[-_]/)[0] : '';
  return code === 'ar' || code === 'en' ? code : null;
};

/** The device's language when it is one we support, otherwise English. */
export function detectDeviceLanguage(): Lang {
  const candidates: unknown[] = [];
  try {
    // iOS: the user's ordered language list (the app locale only reflects
    // languages the bundle declares, so don't rely on it alone)
    if (Platform.OS === 'ios') {
      const langs = Settings.get('AppleLanguages');
      if (Array.isArray(langs)) candidates.push(...langs);
    }
    candidates.push(I18nManager.getConstants().localeIdentifier);
  } catch {
    // Native settings unavailable (tests, unusual builds): fall through
  }
  for (const c of candidates) {
    const lang = asLang(c);
    if (lang) return lang;
  }
  return 'en';
}

/**
 * Stores the layout direction React Native will use on the next launch. The
 * direction of the *current* run can't change, which is why switching
 * between English and Arabic asks for a restart. Only called once the user has
 * picked a language: until then React Native follows the device on its own.
 */
function applyDirection(lang: Lang) {
  const rtl = lang === 'ar';
  // allowRTL(false) also stops an Arabic device from forcing RTL on English
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

function promptRestart(lang: Lang) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  Alert.alert(
    t('lang.restartTitle'),
    t('lang.restartMessage'),
    __DEV__
      ? [
          { text: t('common.ok') },
          { text: t('lang.reload'), onPress: () => DevSettings.reload() },
        ]
      : [{ text: t('common.ok') }],
  );
}

interface I18nContextValue extends I18n {
  /** False until the saved language has been read. */
  ready: boolean;
  setLanguage: (lang: Lang) => void;
}

const defaultValue: I18nContextValue = {
  ...createI18n('en', false),
  ready: true,
  setLanguage: () => {},
};

const I18nContext = createContext<I18nContextValue>(defaultValue);

/** Provides the active language; follows the device until the user picks one. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectDeviceLanguage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        const savedLang = asLang(saved);
        if (!alive || !savedLang) return;
        setLang(savedLang);
        applyDirection(savedLang); // heals a direction left out of step
      })
      .catch(() => {})
      .then(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setLanguage = useCallback((next: Lang) => {
    setLang(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    applyDirection(next);
    if ((next === 'ar') !== I18nManager.isRTL) promptRestart(next);
  }, []);

  const value = useMemo(
    () => ({
      ...createI18n(lang, I18nManager.isRTL),
      ready,
      setLanguage,
    }),
    [lang, ready, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
