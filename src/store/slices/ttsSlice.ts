import type { StateCreator } from 'zustand';
import type { AppStore, TTSSlice } from '../types';
import type { PlaybackState } from '@/types';
import { DEFAULT_SPEED } from '@/lib/constants';

export const createTTSSlice: StateCreator<AppStore, [], [], TTSSlice> = (
  set,
) => ({
  playbackState: 'idle',
  currentWordIndex: 0,
  speed: DEFAULT_SPEED,
  selectedVoiceURI: null,
  availableVoices: [],

  setPlaybackState: (playbackState: PlaybackState) => set({ playbackState }),

  setCurrentWordIndex: (index: number) => set({ currentWordIndex: index }),

  setSpeed: (speed: number) => set({ speed }),

  setVoice: (voiceURI: string) => set({ selectedVoiceURI: voiceURI }),

  loadVoices: () => {
    if (typeof window === 'undefined') return;
    const voices = speechSynthesis.getVoices();
    set({ availableVoices: voices });
  },
});
