import { create } from 'zustand';

interface UiState {
  libraryOpen: boolean;
  setLibraryOpen: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  libraryOpen: false,
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
}));
