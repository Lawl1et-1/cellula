'use client';

import { useEffect, useState } from 'react';
import { stageIndexAt } from '@/engine/timeline/evaluate';
import { fr } from '@/i18n/fr';
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
          if (o) setMessage(`${fr.a11y.selected(o.name.fr)}. ${o.summary.text.fr}`);
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
      setMessage(`${fr.a11y.stage(s.name.fr, stage.title.fr, i + 1, s.stages.length)}. ${stage.description.text.fr}`);
    });
  }, []);

  return (
    <p className="visually-hidden" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
