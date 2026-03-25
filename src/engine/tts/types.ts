import type { PlaybackState } from '@/types';

export interface UtteranceChunk {
  id: number;
  text: string;
  startWordIndex: number;
  endWordIndex: number;
  wordCharOffsets: number[];
}

export interface TTSCallbacks {
  onWordChange: (wordIndex: number) => void;
  onPlaybackStateChange: (state: PlaybackState) => void;
  onChunkComplete: (endWordIndex: number) => void;
  onFinished: () => void;
  onError: (error: string) => void;
}

