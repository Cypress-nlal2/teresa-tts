import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppStore } from './types';
import { createLibrarySlice } from './slices/librarySlice';
import { createReaderSlice } from './slices/readerSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createTTSSlice } from './slices/ttsSlice';

export const useAppStore = create<AppStore>()(
  persist(
    (...args) => ({
      ...createLibrarySlice(...args),
      ...createReaderSlice(...args),
      ...createSettingsSlice(...args),
      ...createTTSSlice(...args),
    }),
    {
      name: 'teresa-tts-settings',
      partialize: (state) => ({
        theme: state.theme,
        touchGuardEnabled: state.touchGuardEnabled,
        speed: state.speed,
        selectedVoiceURI: state.selectedVoiceURI,
      }),
    },
  ),
);

export type { AppStore } from './types';
