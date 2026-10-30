'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { handBridge } from '@/hand/bridge';
import { handSupported, useHand } from '@/hand/store';
import { startHandTracking } from '@/hand/tracker';
import { useT } from '@/i18n/locale';
import styles from './hand.module.css';

/** Starts and stops the webcam and the tracker when hand mode is switched on or off. */
export function HandController() {
  const enabled = useHand((s) => s.enabled);
  useEffect(() => {
    const { setStatus } = useHand.getState();
    if (!enabled) {
      if (useHand.getState().status !== 'error') setStatus('off');
      return;
    }
    if (!handSupported()) {
      useHand.setState({ enabled: false, status: 'error', error: 'unsupported' });
      return;
    }
    let stop: (() => void) | null = null;
    let cancelled = false;
    setStatus('loading');
    void startHandTracking({
      onReady: () => !cancelled && setStatus('on'),
      onError: (error) => useHand.setState({ enabled: false, status: 'error', error }),
    }).then((s) => {
      if (cancelled) s();
      else stop = s;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled]);
  return null;
}

/** The hand cursor: a small ring that changes with the gesture. Moved directly, without React renders. */
export function HandCursor() {
  const status = useHand((s) => s.status);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status !== 'on') return;
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const c = handBridge.cursor;
        el.style.opacity = c ? '1' : '0';
        if (c) el.style.transform = `translate(${c.x}px, ${c.y}px)`;
        if (el.dataset.mode !== handBridge.mode) el.dataset.mode = handBridge.mode;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);
  if (status !== 'on') return null;
  return (
    <div ref={ref} className={styles.cursor} data-mode="none" aria-hidden>
      <span className={styles.ring} />
      <span className={styles.dot} />
      <span className={styles.zoom}>⇔</span>
      <span className={styles.lock}>❚❚</span>
    </div>
  );
}

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
] as const;

/** Mirrored webcam thumbnail with the detected hand skeleton, drawn at a modest rate. */
function Preview() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (frame++ % 2) return;
      const cv = canvas.current;
      const video = handBridge.video;
      const ctx = cv?.getContext('2d');
      if (!cv || !ctx || !video || video.readyState < 2) return;
      const { width: w, height: h } = cv;
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
      ctx.lineWidth = 1.5;
      for (const hand of handBridge.hands) {
        const p = hand.landmarks.map((l) => [(1 - l.x) * w, l.y * h] as const);
        ctx.strokeStyle = 'rgba(143, 227, 255, 0.85)';
        ctx.beginPath();
        for (const [a, b] of CONNECTIONS) {
          ctx.moveTo(p[a]![0], p[a]![1]);
          ctx.lineTo(p[b]![0], p[b]![1]);
        }
        ctx.stroke();
        ctx.fillStyle = '#ff8fc1';
        for (const [x, y] of p) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} className={`glass ${styles.preview}`} width={192} height={144} />;
}

/** Hand mode status: what the hand is doing, local-processing notice, preview, gestures, stop. */
export function HandStatus() {
  const t = useT();
  const { enabled, status, error, preview, setPreview, setEnabled, setTutorial } = useHand();
  const hint = useRef<HTMLSpanElement>(null);
  const modes = useRef(t.hand.modes);
  modes.current = t.hand.modes;

  useEffect(() => {
    if (status !== 'on') return;
    let raf = 0;
    let shown = '';
    const tick = () => {
      const text = modes.current[handBridge.cursor ? handBridge.mode : 'none'] ?? '';
      if (text !== shown && hint.current) hint.current.textContent = shown = text;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  if (error && !enabled) {
    return (
      <div className={`glass ${styles.status} ${styles.error}`} role="alert">
        <span>{t.hand[error]}</span>
        <button className={styles.iconButton} onClick={() => useHand.setState({ status: 'off', error: null })} aria-label={t.panel.close}>
          ×
        </button>
      </div>
    );
  }
  if (!enabled) return null;

  return (
    <>
      <div className={`glass ${styles.status}`} role="status">
        <span className={styles.live} data-on={status === 'on'} aria-hidden />
        <span className={styles.texts}>
          <strong>{status === 'on' ? t.hand.title : t.hand.loading}</strong>
          {status === 'on' ? <span ref={hint} className={styles.hint} /> : null}
          <span className={styles.local} title={t.hand.privacy}>
            {t.hand.privacyShort}
          </span>
        </span>
        <button className={styles.textButton} aria-pressed={preview} aria-label={t.hand.previewLabel} onClick={() => setPreview(!preview)}>
          {t.hand.preview}
        </button>
        <button className={styles.textButton} onClick={() => setTutorial(true)}>
          {t.hand.help}
        </button>
        <button className={styles.iconButton} onClick={() => setEnabled(false)} aria-label={t.hand.stop}>
          ×
        </button>
      </div>
      {preview && status === 'on' && <Preview />}
    </>
  );
}

function Icon({ kind }: { kind: 'orbit' | 'point' | 'pinch' | 'zoom' | 'fist' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden {...common}>
      {kind === 'orbit' && (
        <>
          <path d="M18 34V18m5 16V13m5 21V15m5 19V20M13 33l-2-7" />
          <path d="M14 34c0 6 5 9 10 9s10-3 10-9" />
          <path d="M6 10c4-4 10-6 18-6m0 0-3-3m3 3-3 3" />
        </>
      )}
      {kind === 'point' && (
        <>
          <path d="M20 34V16m5 18V22m5 12V24m5 10V26" />
          <path d="M15 34c0 6 5 9 10 9s10-3 10-9" />
        </>
      )}
      {kind === 'pinch' && (
        <>
          <circle cx="24" cy="14" r="3" />
          <path d="M14 20c4-2 7-4 10-6m10 6c-4-2-7-4-10-6" />
          <path d="M16 34c0 6 4 9 9 9s9-3 9-9V24" />
        </>
      )}
      {kind === 'zoom' && (
        <>
          <path d="M12 30V18m4 12V16m4 14V19" />
          <path d="M36 30V18m-4 12V16m-4 14V19" />
          <path d="M4 40h10m-3-3 3 3-3 3M44 40H34m3-3-3 3 3 3" />
        </>
      )}
      {kind === 'fist' && (
        <>
          <rect x="14" y="16" width="20" height="16" rx="6" />
          <path d="M20 16v6m6-6v6m6-5v5M16 32c0 6 4 10 9 10s9-4 9-10" />
        </>
      )}
    </svg>
  );
}

/** Shown the first time hand mode is switched on (and from the "Gestures" button). */
export function HandTutorial() {
  const t = useT();
  const open = useHand((s) => s.tutorial);
  const close = () => useHand.getState().setTutorial(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const tt = t.hand.tutorial;
  const items = [
    { kind: 'orbit', title: tt.orbit, text: tt.orbitText },
    { kind: 'point', title: tt.point, text: tt.pointText },
    { kind: 'pinch', title: tt.pinch, text: tt.pinchText },
    { kind: 'zoom', title: tt.zoom, text: tt.zoomText },
    { kind: 'fist', title: tt.fist, text: tt.fistText },
  ] as const;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            className={`glass ${styles.tutorial}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hand-tutorial-title"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="hand-tutorial-title" className={styles.tutorialTitle}>
              {tt.title}
            </h2>
            <p className={styles.tutorialLead}>{tt.lead}</p>
            <ul className={styles.gestures}>
              {items.map((it) => (
                <li key={it.kind}>
                  <span className={styles.gestureIcon}>
                    <Icon kind={it.kind} />
                  </span>
                  <span>
                    <strong>{it.title}</strong>
                    <span>{it.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.privacy}>
              <strong>{t.hand.privacy}</strong> {t.hand.model}
            </p>
            <button ref={button} className={styles.start} onClick={close}>
              {tt.start}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
