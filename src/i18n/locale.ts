'use client';

import { useSyncExternalStore } from 'react';
import type { LocalizedText } from '@/content/schema/common';
import { fr } from './fr';
import { en } from './en';
import { STORAGE_KEY, type Locale } from './config';

/**
 * Interface language, switched on the client without a reload: the 3D scene, the camera and every store
 * keep their state. The choice is remembered in localStorage and in a cookie.
 * The server always renders French; the stored choice is applied right after hydration.
 */
let current: Locale = 'fr';
const listeners = new Set<() => void>();

function stored(): Locale {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'fr' || v === 'en') return v;
  } catch {
    // Storage blocked (private mode…): fall back to the cookie.
  }
  const m = document.cookie.match(new RegExp(`(?:^|; )${STORAGE_KEY}=(fr|en)`));
  return (m?.[1] as Locale | undefined) ?? 'fr';
}

if (typeof window !== 'undefined') current = stored();

export function setLocale(locale: Locale) {
  if (locale === current) return;
  current = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not fatal: the cookie still remembers it.
  }
  document.cookie = `${STORAGE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const getLocale = () => current;

/** Current interface language ('fr' while server rendering and hydrating). */
export const useLocale = () => useSyncExternalStore(subscribe, getLocale, () => 'fr' as Locale);

export const DICTIONARIES = { fr, en };

/** UI strings of the current language. */
export const useT = () => DICTIONARIES[useLocale()];

/** Picks the current language from a content string, falling back to French. */
export const pick = (text: LocalizedText, locale: Locale) => text[locale] ?? text.fr;

/** `pick` bound to the current language. */
export function useL() {
  const locale = useLocale();
  return (text: LocalizedText) => pick(text, locale);
}
