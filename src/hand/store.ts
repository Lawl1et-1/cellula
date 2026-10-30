import { create } from 'zustand';

export type HandStatus = 'off' | 'loading' | 'on' | 'error';
export type HandError = 'denied' | 'unsupported' | 'failed' | null;

const TUTORIAL_KEY = 'cellula-hand-tutorial';

interface HandState {
  /** Hand mode chosen in the settings (mouse and touch stay the default). */
  enabled: boolean;
  status: HandStatus;
  error: HandError;
  /** Small mirrored webcam preview with the detected landmarks. */
  preview: boolean;
  tutorial: boolean;
  setEnabled: (enabled: boolean) => void;
  setStatus: (status: HandStatus, error?: HandError) => void;
  setPreview: (preview: boolean) => void;
  setTutorial: (open: boolean) => void;
}

const tutorialSeen = () => {
  try {
    return window.localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
};

export const useHand = create<HandState>((set) => ({
  enabled: false,
  status: 'off',
  error: null,
  preview: false,
  tutorial: false,
  // The first time hand mode is switched on, the gesture tutorial opens.
  setEnabled: (enabled) => set({ enabled, error: null, ...(enabled && !tutorialSeen() ? { tutorial: true } : {}) }),
  setStatus: (status, error = null) => set({ status, error }),
  setPreview: (preview) => set({ preview }),
  setTutorial: (tutorial) => {
    if (!tutorial) {
      try {
        window.localStorage.setItem(TUTORIAL_KEY, '1');
      } catch {
        // Private mode: the tutorial will simply show again next time.
      }
    }
    set({ tutorial });
  },
}));

/** Webcam, workers and module workers are needed. */
export const handSupported = () =>
  typeof window !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof Worker !== 'undefined' &&
  typeof createImageBitmap !== 'undefined';
