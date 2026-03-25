import type { StateCreator } from 'zustand';
import type { AppStore, ReaderSlice } from '../types';
import { getAdjacentChapterWords } from '@/db/documents';

export const createReaderSlice: StateCreator<
  AppStore,
  [],
  [],
  ReaderSlice
> = (set) => ({
  currentDocId: null,
  currentChapterIndex: 0,
  currentChapterWords: [],
  adjacentChapterWords: {
    prev: null,
    next: null,
  },

  openDocument: async (docId: string, chapterIndex = 0) => {
    const { prev, current, next } = await getAdjacentChapterWords(
      docId,
      chapterIndex,
    );

    set({
      currentDocId: docId,
      currentChapterIndex: chapterIndex,
      currentChapterWords: current,
      adjacentChapterWords: { prev, next },
    });
  },

  closeDocument: () =>
    set({
      currentDocId: null,
      currentChapterIndex: 0,
      currentChapterWords: [],
      adjacentChapterWords: { prev: null, next: null },
    }),

  setChapter: async (chapterIndex: number) => {
    const docId = useAppStoreDocId();
    if (!docId) return;

    const { prev, current, next } = await getAdjacentChapterWords(
      docId,
      chapterIndex,
    );

    set({
      currentChapterIndex: chapterIndex,
      currentChapterWords: current,
      adjacentChapterWords: { prev, next },
    });
  },
});

/**
 * Helper to read currentDocId from the store at call time.
 * We use zustand's getState via a lazy import to avoid circular deps.
 */
function useAppStoreDocId(): string | null {
  // This will be resolved at runtime after the store is created.
  // We use dynamic require to break the circular dependency.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAppStore } = require('../index') as {
    useAppStore: { getState: () => AppStore };
  };
  return useAppStore.getState().currentDocId;
}
