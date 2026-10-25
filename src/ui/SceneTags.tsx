'use client';

import { useEffect, useRef } from 'react';
import { stageIndexAt } from '@/engine/timeline/evaluate';
import { useL, useT } from '@/i18n/locale';
import { useSelection } from '@/state/selection';
import { BASE_COLORS, DNA_TAGS } from '@/scene/organelles/DnaCompaction';
import { labelScreen } from '@/scene/actors/labels';
import { useScenario } from '@/state/scenario';

/**
 * Focus mode labels (the virus, its receptor, viral RNA…), drawn in the DOM above the canvas and below the
 * panels. Their screen positions come from the scene every frame.
 */
export function SceneTags() {
  const l = useL();
  const t = useT();
  const dna = useSelection((s) => s.selected?.organelle === 'dna');
  const scenario = useScenario((s) => s.scenario);
  const index = useScenario((s) => (s.scenario ? stageIndexAt(s.scenario.stages, s.t) : -1));
  const stage = scenario && index >= 0 ? scenario.stages[index] : undefined;
  const refs = useRef(new Map<string, HTMLSpanElement>());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const [key, el] of refs.current) {
        const p = labelScreen.get(key);
        if (!p) {
          el.style.opacity = '0';
          continue;
        }
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        // Not under the top bar (wordmark, menu, language switch).
        const top = window.innerWidth <= 640 ? 120 : 70;
        el.style.opacity = p.visible && p.y - el.offsetHeight > top ? '1' : '0';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const id = stage ? `${scenario!.id}:${stage.id}` : '';
  const tags: { key: string; text: string; color?: string }[] = stage
    ? [
        ...stage.heroes.flatMap((h, i) => (h.label ? [{ key: `${id}:hero:${i}`, text: l(h.label) }] : [])),
        ...stage.labels.map((lb, i) => ({ key: `${id}:label:${i}`, text: l(lb.text) })),
      ]
    : dna
      ? DNA_TAGS.map((k) => ({
          key: `dna:${k}`,
          text: t.dna.tags[k]!,
          color: k === 'backbone' ? undefined : BASE_COLORS[k],
        }))
      : [];
  if (!tags.length) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }} aria-hidden>
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="scene-tag"
          style={{ position: 'absolute', left: 0, top: 0, opacity: 0, transition: 'opacity 0.4s' }}
          ref={(el) => {
            if (el) refs.current.set(tag.key, el);
            else refs.current.delete(tag.key);
          }}
        >
          {tag.color && <i className="scene-tag-dot" style={{ background: tag.color }} />}
          {tag.text}
        </span>
      ))}
    </div>
  );
}
