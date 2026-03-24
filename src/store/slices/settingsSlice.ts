import type { StateCreator } from 'zustand';
import type { AppStore, SettingsSlice } from '../types';
import type { ThemePreference } from '@/types';

export const createSettingsSlice: StateCreator<
  AppStore,
  [],
  [],
  SettingsSlice
> = (set) => ({
  theme: 'system',
  touchGuardEnabled: false,

  setTheme: (theme: ThemePreference) => set({ theme }),

  toggleTouchGuard: () =>
    set((state) => ({ touchGuardEnabled: !state.touchGuardEnabled })),
});
