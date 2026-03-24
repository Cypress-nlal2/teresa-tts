import type { DBSchema } from 'idb';
import type { DocumentMeta, ReadingState, Word } from '@/types';

export interface ChapterWordsRecord {
  docId: string;
  chapterIndex: number;
  words: Word[];
}

export interface TeresaDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentMeta;
    indexes: {
      'by-added': number;
    };
  };
  chapterWords: {
    key: [string, number];
    value: ChapterWordsRecord;
    indexes: {
      'by-doc': string;
    };
  };
  readingState: {
    key: string;
    value: ReadingState;
  };
}
