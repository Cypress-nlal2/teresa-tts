import type {
  DocumentMeta,
  ParsingProgress,
  PlaybackState,
  ThemePreference,
  Word,
} from '@/types';

export interface LibrarySlice {
  documents: DocumentMeta[];
  parsingState: ParsingProgress;

  addDocument: (meta: DocumentMeta, wordsByChapter: Word[][]) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  setParsingState: (state: Partial<ParsingProgress>) => void;
  loadDocumentList: () => Promise<void>;
}

export interface ReaderSlice {
  currentDocId: string | null;
  currentChapterIndex: number;
  currentChapterWords: Word[];
  adjacentChapterWords: {
    prev: Word[] | null;
    next: Word[] | null;
  };

  openDocument: (docId: string, chapterIndex?: number) => Promise<void>;
  closeDocument: () => void;
  setChapter: (chapterIndex: number) => Promise<void>;
}

export interface SettingsSlice {
  theme: ThemePreference;
  touchGuardEnabled: boolean;

  setTheme: (theme: ThemePreference) => void;
  toggleTouchGuard: () => void;
}

export interface TTSSlice {
  playbackState: PlaybackState;
  currentWordIndex: number;
  speed: number;
  selectedVoiceURI: string | null;
  availableVoices: SpeechSynthesisVoice[];

  setPlaybackState: (state: PlaybackState) => void;
  setCurrentWordIndex: (index: number) => void;
  setSpeed: (speed: number) => void;
  setVoice: (voiceURI: string) => void;
  loadVoices: () => void;
}

export type AppStore = LibrarySlice & ReaderSlice & SettingsSlice & TTSSlice;
