import { create } from 'zustand';

interface UiState {
  libraryOpen: boolean;
  /** Phone layout: settings sheet and disease details sheet are opened on demand. */
  settingsOpen: boolean;
  diseaseSheet: boolean;
  /** DNA compaction close-up: index of the level shown (null = closed). */
  dnaLevel: number | null;
  /** Focus mode keeps the camera on the action; the reader can unlock it to look around. */
  cameraUnlocked: boolean;
  setCameraUnlocked: (unlocked: boolean) => void;
  setDnaLevel: (level: number | null) => void;
  setLibraryOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setDiseaseSheet: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  libraryOpen: false,
  settingsOpen: false,
  diseaseSheet: false,
  dnaLevel: null,
  cameraUnlocked: false,
  setCameraUnlocked: (cameraUnlocked) => set({ cameraUnlocked }),
  setDnaLevel: (dnaLevel) => set({ dnaLevel }),
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setDiseaseSheet: (diseaseSheet) => set({ diseaseSheet }),
}));
