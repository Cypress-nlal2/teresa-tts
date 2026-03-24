import type { StateCreator } from 'zustand';
import type { AppStore, TTSSlice } from '../types';
import type { PlaybackState } from '@/types';
import {
  DEFAULT_SPEED,
  SKIP_FORWARD_WORDS,
  SKIP_BACKWARD_WORDS,
} from '@/lib/constants';

export const createTTSSlice: StateCreator<AppStore, [], [], TTSSlice> = (
  set,
  get,
) => ({
  playbackState: 'idle',
  currentWordIndex: 0,
  speed: DEFAULT_SPEED,
  selectedVoiceURI: null,
  availableVoices: [],

  play: () => set({ playbackState: 'playing' }),

  pause: () => set({ playbackState: 'paused' }),

  resume: () => set({ playbackState: 'playing' }),

  seekToWord: (wordIndex: number) => set({ currentWordIndex: wordIndex }),

  skipForward: () =>
    set((state) => ({
      currentWordIndex: state.currentWordIndex + SKIP_FORWARD_WORDS,
    })),

  skipBackward: () =>
    set((state) => ({
      currentWordIndex: Math.max(0, state.currentWordIndex - SKIP_BACKWARD_WORDS),
    })),

  skipChapterForward: () => {
    const state = get();
    const doc = state.documents.find((d) => d.id === state.currentDocId);
    if (!doc) return;

    const nextChapter = state.currentChapterIndex + 1;
    if (nextChapter < doc.chapters.length) {
      state.setChapter(nextChapter);
      set({ currentWordIndex: doc.chapters[nextChapter].startWordIndex });
    }
  },

  skipChapterBackward: () => {
    const state = get();
    const doc = state.documents.find((d) => d.id === state.currentDocId);
    if (!doc) return;

    const prevChapter = state.currentChapterIndex - 1;
    if (prevChapter >= 0) {
      state.setChapter(prevChapter);
      set({ currentWordIndex: doc.chapters[prevChapter].startWordIndex });
    }
  },

  setSpeed: (speed: number) => set({ speed }),

  setVoice: (voiceURI: string) => set({ selectedVoiceURI: voiceURI }),

  setCurrentWordIndex: (index: number) => set({ currentWordIndex: index }),

  setPlaybackState: (playbackState: PlaybackState) => set({ playbackState }),

  loadVoices: () => {
    if (typeof window === 'undefined') return;
    const voices = speechSynthesis.getVoices();
    set({ availableVoices: voices });
  },
});
