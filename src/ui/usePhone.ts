'use client';

import { useSyncExternalStore } from 'react';

const query = (q: string) => ({
  subscribe: (cb: () => void) => {
    const m = window.matchMedia(q);
    m.addEventListener('change', cb);
    return () => m.removeEventListener('change', cb);
  },
  get: () => window.matchMedia(q).matches,
});

const phone = query('(max-width: 640px)');
const touch = query('(pointer: coarse)');

/** Phone-sized viewport: panels become bottom sheets, settings move behind a button. */
export const usePhone = () => useSyncExternalStore(phone.subscribe, phone.get, () => false);

/** Touch-first device: no keyboard-driven free flight. */
export const useTouch = () => useSyncExternalStore(touch.subscribe, touch.get, () => false);
