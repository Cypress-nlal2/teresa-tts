/** Word represents a single tokenized word in a document */
export interface Word {
  index: number;
  text: string;
  chapterIndex: number;
  paragraphBreakBefore: boolean;
}

/** Chapter represents a section of the document */
export interface Chapter {
  title: string;
  startWordIndex: number;
  endWordIndex: number;
}

/** DocumentMeta is what goes in the Zustand store (lightweight) */
export interface DocumentMeta {
  id: string;
  title: string;
  fileName: string;
  format: 'pdf' | 'docx' | 'txt' | 'epub';
  totalWords: number;
  chapters: Chapter[];
  addedAt: number;
  fileSize: number;
}

/** ParsedDocument is what the parsers produce */
export interface ParsedDocument {
  id: string;
  title: string;
  fileName: string;
  format: 'pdf' | 'docx' | 'txt' | 'epub';
  chapters: Chapter[];
  words: Word[];
  totalWords: number;
  fileSize: number;
}

/** ReadingState persisted in IndexedDB */
export interface ReadingState {
  docId: string;
  currentWordIndex: number;
  currentChapterIndex: number;
  speed: number;
  voiceURI: string | null;
  lastReadAt: number;
  isFinished: boolean;
}

/** Playback state enum */
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'loading';

/** Theme preference */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Parsing progress */
export interface ParsingProgress {
  isActive: boolean;
  fileName: string;
  progress: number;
  error: string | null;
}
