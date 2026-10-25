'use client';

import { motion } from 'framer-motion';
import { useT } from '@/i18n/locale';
import styles from './ui.module.css';

const rise = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { delay: 0.5 + i * 0.16, duration: 1.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function IntroOverlay({ onEnter }: { onEnter: () => void }) {
  const t = useT();
  return (
    <motion.section
      className={styles.intro}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } }}
      aria-labelledby="intro-title"
    >
      <div className={styles.introInner}>
        <motion.p className="label" variants={rise} initial="hidden" animate="show" custom={0}>
          {t.intro.kicker}
        </motion.p>
        <motion.h1 id="intro-title" className={styles.introTitle} variants={rise} initial="hidden" animate="show" custom={1}>
          <span className={styles.brand}>{t.brand}</span>
          <span className={styles.introSub}>{t.intro.title}</span>
        </motion.h1>
        <motion.p className={styles.introLead} variants={rise} initial="hidden" animate="show" custom={2}>
          {t.intro.lead}
        </motion.p>
        <motion.div variants={rise} initial="hidden" animate="show" custom={3}>
          <button className={styles.enter} onClick={onEnter} autoFocus>
            <span className={styles.enterDot} aria-hidden />
            {t.intro.enter}
          </button>
        </motion.div>
      </div>
      <motion.p
        className={`label ${styles.introScale}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 1.6, duration: 1.2 } }}
      >
        {t.intro.scale}
      </motion.p>
    </motion.section>
  );
}
