'use client';

import { useEffect, useState } from 'react';
import { stageIndexAt } from '@/engine/timeline/evaluate';
import { DICTIONARIES, getLocale, pick } from '@/i18n/locale';
import { useScenario } from '@/state/scenario';
import { useSelection } from '@/state/selection';
import { useContent } from './ContentContext';

/**
 * Screen-reader narration of what happens in the 3D scene (which is otherwise invisible to assistive
 * technology): the selected organelle and each new stage of a running process or disease.
 */
export function Announcer() {
  const content = useContent();
  const [message, setMessage] = useState('');

  useEffect(
    () =>
      useSelection.subscribe((state, prev) => {
        if (state.selected && state.selected !== prev.selected) {
          const o = content.organelle(state.selected.organelle);
          const locale = getLocale();
          if (o) setMessage(`${DICTIONARIES[locale].a11y.selected(pick(o.name, locale))}. ${pick(o.summary.text, locale)}`);
        }
      }),
    [content],
  );

  useEffect(() => {
    let last = '';
    return useScenario.subscribe((state) => {
      const s = state.scenario;
      if (!s) {
        last = '';
        return;
      }
      const i = stageIndexAt(s.stages, state.t);
      const key = `${s.id}:${i}`;
      if (key === last) return;
      last = key;
      const stage = s.stages[i]!;
      const locale = getLocale();
      const l = (text: Parameters<typeof pick>[0]) => pick(text, locale);
      setMessage(`${DICTIONARIES[locale].a11y.stage(l(s.name), l(stage.title), i + 1, s.stages.length)}. ${l(stage.description.text)}`);
    });
  }, []);

  return (
    <p className="visually-hidden" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
