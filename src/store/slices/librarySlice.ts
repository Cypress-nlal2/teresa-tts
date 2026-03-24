import type { StateCreator } from 'zustand';
import type { AppStore, LibrarySlice } from '../types';
import type { DocumentMeta, ParsingProgress, Word } from '@/types';
import {
  saveDocument,
  getAllDocuments,
  deleteDocument,
} from '@/db/documents';

export const createLibrarySlice: StateCreator<
  AppStore,
  [],
  [],
  LibrarySlice
> = (set) => ({
  documents: [],
  parsingState: {
    isActive: false,
    fileName: '',
    progress: 0,
    error: null,
  },

  addDocument: async (meta: DocumentMeta, wordsByChapter: Word[][]) => {
    await saveDocument(meta, wordsByChapter);
    set((state) => ({
      documents: [meta, ...state.documents],
    }));
  },

  removeDocument: async (id: string) => {
    await deleteDocument(id);
    set((state) => ({
      documents: state.documents.filter((doc) => doc.id !== id),
    }));
  },

  setParsingState: (partial: Partial<ParsingProgress>) =>
    set((state) => ({
      parsingState: { ...state.parsingState, ...partial },
    })),

  loadDocumentList: async () => {
    const documents = await getAllDocuments();
    set({ documents });
  },
});
