'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { handBridge } from '@/hand/bridge';
import { handSupported, useHand } from '@/hand/store';
import { startHandTracking } from '@/hand/tracker';
import { useT } from '@/i18n/locale';
import { useScenario } from '@/state/scenario';
import { useUi } from '@/state/ui';
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

type IconKind = 'open' | 'closed' | 'between' | 'none' | 'zoomIn' | 'zoomOut' | 'pan' | 'rotate' | 'idle' | 'locked';

/** Small line icons, drawn in the current colour. */
function Icon({ kind, size = 22 }: { kind: IconKind; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden {...p}>
      {kind === 'open' && <path d="M8 13V5.5m3 7V4m3 8.5V5m3 8V7.5M5.5 12.5l1.5 4c1 2.5 3 4 5.5 4s4.5-2 4.5-5V13" />}
      {kind === 'closed' && (
        <>
          <rect x="6" y="8" width="12" height="9" rx="3.5" />
          <path d="M9.5 8v3m3-3v3m3-3v3M8 17c0 2 1.8 3.5 4 3.5s4-1.5 4-3.5" />
        </>
      )}
      {kind === 'between' && <path d="M8 13V9m3 3V7.5m3 4.5V8.5m3 4.5v-2M5.5 12.5l1.5 4c1 2.5 3 4 5.5 4s4.5-2 4.5-5V13" />}
      {kind === 'none' && <path d="M8 13V5.5m3 7V4m3 8.5V5m3 8V7.5M5.5 12.5l1.5 4c1 2.5 3 4 5.5 4s4.5-2 4.5-5V13M4 4l16 16" />}
      {(kind === 'zoomIn' || kind === 'zoomOut') && (
        <>
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="M15 15l5 5M8 10.5h5" />
          {kind === 'zoomIn' && <path d="M10.5 8v5" />}
        </>
      )}
      {kind === 'pan' && <path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />}
      {kind === 'rotate' && (
        <>
          <ellipse cx="12" cy="12" rx="5" ry="8" />
          <path d="M4 12a8 4 0 0 0 16 0M20 12l-2.5-1.5M20 12l-1 2.6" />
        </>
      )}
      {kind === 'idle' && <circle cx="12" cy="12" r="3" />}
      {kind === 'locked' && (
        <>
          <rect x="6" y="11" width="12" height="9" rx="2" />
          <path d="M9 11V8a3 3 0 0 1 6 0v3" />
        </>
      )}
    </svg>
  );
}

const SHAPES = ['open', 'closed', 'between', 'none'] as const;
const ACTIONS = ['idle', 'pan', 'rotate', 'zoomIn', 'zoomOut', 'locked'] as const;

/**
 * What the system thinks the hands are doing: a badge per hand (detected? open or closed?), the current action,
 * and a large flash in the middle of the screen for each zoom step. Updated directly, without React renders.
 */
function useHandFeedback(
  root: React.RefObject<HTMLElement | null>,
  flash: React.RefObject<HTMLElement | null>,
  rateText: React.RefObject<(n: number, backend: string) => string>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let shownRate = '';
    const tick = () => {
      const el = root.current;
      if (el) {
        for (const side of ['left', 'right'] as const) {
          const h = handBridge.hands[side];
          el.dataset[side] = h ? h.shape : 'none';
        }
        el.dataset.rightPan = String(handBridge.panning);
        el.dataset.leftRotate = String(handBridge.rotating);
        const framed = !!useScenario.getState().scenario && !useUi.getState().cameraUnlocked;
        const zoomAge = performance.now() - handBridge.lastZoom.at;
        // Several actions can show at once (panning with the right hand while rotating with the left).
        const actions: string[] = [];
        if (framed) actions.push('locked');
        else {
          if (zoomAge < 700 && handBridge.lastZoom.dir) actions.push(handBridge.lastZoom.dir > 0 ? 'zoomIn' : 'zoomOut');
          if (handBridge.panning) actions.push('pan');
          if (handBridge.rotating) actions.push('rotate');
          if (!actions.length) actions.push('idle');
        }
        el.dataset.action = actions.join(' ');
        if (flash.current) {
          flash.current.dataset.show = String(zoomAge < 700 && !framed && !!handBridge.lastZoom.dir);
          flash.current.dataset.dir = handBridge.lastZoom.dir > 0 ? 'in' : 'out';
        }
        const rate = el.querySelector<HTMLElement>('[data-rate]');
        const text = rateText.current(handBridge.fps, handBridge.backend);
        if (rate && text !== shownRate) rate.textContent = shownRate = text;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [root, flash, rateText, active]);
}

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
] as const;

/** Mirrored webcam thumbnail with the detected hand skeletons, drawn at a modest rate. */
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
      for (const hand of handBridge.raw) {
        const pts = hand.landmarks.map((l) => [(1 - l.x) * w, l.y * h] as const);
        ctx.strokeStyle = 'rgba(143, 227, 255, 0.85)';
        ctx.beginPath();
        for (const [a, b] of CONNECTIONS) {
          ctx.moveTo(pts[a]![0], pts[a]![1]);
          ctx.lineTo(pts[b]![0], pts[b]![1]);
        }
        ctx.stroke();
        ctx.fillStyle = '#ff8fc1';
        for (const [x, y] of pts) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} className={`glass ${styles.preview}`} width={192} height={144} />;
}

/** Hand mode status: detected hands, current action, local-processing notice, preview, gestures, stop. */
export function HandStatus() {
  const t = useT();
  const { enabled, status, error, preview, setPreview, setEnabled, setTutorial } = useHand();
  const root = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const rateText = useRef(t.hand.rate);
  rateText.current = t.hand.rate;
  useHandFeedback(root, flash, rateText, status === 'on');

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

  const on = status === 'on';
  return (
    <>
      <div ref={root} className={`glass ${styles.status}`} role="status" data-left="none" data-right="none" data-action="idle">
        <span className={styles.live} data-on={on} aria-hidden />
        <span className={styles.texts}>
          <strong>{on ? t.hand.title : t.hand.loading}</strong>
          <span className={styles.local} title={t.hand.privacy}>
            {t.hand.privacyShort}
          </span>
          {on && <span className={styles.rate} data-rate />}
        </span>
        {on && (
          <>
            {(['left', 'right'] as const).map((side) => (
              <span key={side} className={styles.side} data-side={side} title={t.hand[side]}>
                <b>{side === 'left' ? t.hand.leftShort : t.hand.rightShort}</b>
                {SHAPES.map((shape) => (
                  <span key={shape} className={styles.shape} data-shape={shape} title={t.hand.shapes[shape]}>
                    <Icon kind={shape} size={18} />
                  </span>
                ))}
              </span>
            ))}
            <span className={styles.action}>
              {ACTIONS.map((a) => (
                <span key={a} className={styles.actionItem} data-action={a}>
                  <Icon kind={a} size={18} />
                  <span>{t.hand.actions[a]}</span>
                </span>
              ))}
            </span>
          </>
        )}
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
      {/* Large feedback in the middle of the screen for each zoom step. */}
      {on && (
        <div ref={flash} className={styles.flash} data-show="false" data-dir="in" aria-hidden>
          <span className={styles.flashIn}>
            <Icon kind="zoomIn" size={46} />
          </span>
          <span className={styles.flashOut}>
            <Icon kind="zoomOut" size={46} />
          </span>
        </div>
      )}
      {preview && on && <Preview />}
    </>
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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useHand.getState().setTutorial(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const tt = t.hand.tutorial;
  const items = [
    { icons: ['open', 'closed', 'zoomIn'], title: tt.zoomIn, text: tt.zoomInText },
    { icons: ['open', 'closed', 'zoomOut'], title: tt.zoomOut, text: tt.zoomOutText },
    { icons: ['open', 'pan'], title: tt.pan, text: tt.panText },
    { icons: ['open', 'rotate'], title: tt.rotate, text: tt.rotateText },
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
                <li key={it.title}>
                  <span className={styles.gestureIcon}>
                    {it.icons.map((k, i) => (
                      <Icon key={i} kind={k} size={22} />
                    ))}
                  </span>
                  <span>
                    <strong>{it.title}</strong>
                    <span>{it.text}</span>
                  </span>
                </li>
              ))}
              <li>
                <span className={styles.gestureIcon}>
                  <b className={styles.sideLetter}>{t.hand.leftShort}</b>
                  <b className={styles.sideLetter}>{t.hand.rightShort}</b>
                </span>
                <span>
                  <strong>{tt.feedback}</strong>
                  <span>{tt.feedbackText}</span>
                </span>
              </li>
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
