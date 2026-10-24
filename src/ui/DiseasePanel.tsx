'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { stageIndexAt } from '@/engine/timeline/evaluate';
import { fr } from '@/i18n/fr';
import { useScenario } from '@/state/scenario';
import { useSelection } from '@/state/selection';
import { useContent } from './ContentContext';
import { DiseaseDetails } from './DiseaseDetails';
import panel from './panel.module.css';

/** Right-hand panel while a disease plays: what it is, why, and what is visible right now. */
export function DiseasePanel() {
  const scenario = useScenario((s) => s.scenario);
  const t = useScenario((s) => s.t);
  const selected = useSelection((s) => s.selected);
  const content = useContent();
  const disease = scenario?.kind === 'disease' ? scenario : null;

  return (
    <AnimatePresence>
      {disease && !selected && (
        <motion.aside
          key={disease.id}
          className={`glass ${panel.panel}`}
          style={{ ['--accent' as string]: '#ff8a8a' }}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, x: 24, transition: { duration: 0.25 } }}
          aria-labelledby="disease-title"
        >
          <header className={panel.header}>
            <span className="label">{fr.diseases.kicker}</span>
            <h2 id="disease-title" className={panel.title}>
              {disease.name.fr}
            </h2>
            <Link className={panel.tagline} href={`/maladies/${disease.slug}`}>
              {fr.diseases.readMore} →
            </Link>
          </header>
          <div className={panel.body}>
            <DiseaseDetails disease={disease} sources={content.sources} stage={stageIndexAt(disease.stages, t)} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
