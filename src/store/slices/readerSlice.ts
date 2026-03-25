import type { StateCreator } from 'zustand';
import type { AppStore, ReaderSlice } from '../types';
import { getAdjacentChapterWords } from '@/db/documents';

export const createReaderSlice: StateCreator<
  AppStore,
  [],
  [],
  ReaderSlice
> = (set, get) => ({
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
    const docId = get().currentDocId;
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
