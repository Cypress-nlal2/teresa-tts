'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store';
import { TTSEngine } from '@/engine/tts/TTSEngine';
import { getPlatformTTSStrategy, isSafari } from '@/lib/platformDetector';
import { getReadingState, saveReadingState } from '@/db/readingState';
import { POSITION_SAVE_DEBOUNCE_MS } from '@/lib/constants';
import type { Word, Chapter, ReadingState } from '@/types';
import type { TTSCallbacks } from '@/engine/tts/types';

export function useTTS(words: Word[], chapters: Chapter[], docId: string) {
  const engineRef = useRef<TTSEngine | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordIndexRef = useRef(0);
  const initializedRef = useRef(false);

  const setPlaybackState = useAppStore((s) => s.setPlaybackState);
  const setCurrentWordIndex = useAppStore((s) => s.setCurrentWordIndex);
  const loadVoices = useAppStore((s) => s.loadVoices);
  const speed = useAppStore((s) => s.speed);
  const selectedVoiceURI = useAppStore((s) => s.selectedVoiceURI);
  const playbackState = useAppStore((s) => s.playbackState);
  const currentWordIndex = useAppStore((s) => s.currentWordIndex);
  const availableVoices = useAppStore((s) => s.availableVoices);
  const currentChapterIndex = useAppStore((s) => s.currentChapterIndex);
  const setSpeed = useAppStore((s) => s.setSpeed);
  const setVoice = useAppStore((s) => s.setVoice);

  // Debounced save to IndexedDB
  const debouncedSave = useCallback(
    (wordIndex: number) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        const state: ReadingState = {
          docId,
          currentWordIndex: wordIndex,
          currentChapterIndex: useAppStore.getState().currentChapterIndex,
          speed: useAppStore.getState().speed,
          voiceURI: useAppStore.getState().selectedVoiceURI,
          lastReadAt: Date.now(),
          isFinished: false,
        };
        saveReadingState(state);
      }, POSITION_SAVE_DEBOUNCE_MS);
    },
    [docId],
  );

  // Create engine on mount
  useEffect(() => {
    if (words.length === 0) return;

    const platformConfig = getPlatformTTSStrategy();

    const callbacks: TTSCallbacks = {
      onWordChange: (wordIndex: number) => {
        wordIndexRef.current = wordIndex;
        setCurrentWordIndex(wordIndex);
        debouncedSave(wordIndex);
      },
      onPlaybackStateChange: (state) => {
        setPlaybackState(state);
      },
      onChunkComplete: () => {
        // No additional handling needed
      },
      onFinished: () => {
        const readingState: ReadingState = {
          docId,
          currentWordIndex: wordIndexRef.current,
          currentChapterIndex: useAppStore.getState().currentChapterIndex,
          speed: useAppStore.getState().speed,
          voiceURI: useAppStore.getState().selectedVoiceURI,
          lastReadAt: Date.now(),
          isFinished: true,
        };
        saveReadingState(readingState);
      },
      onError: (error: string) => {
        console.error('[TTS Error]', error);
      },
    };

    const engine = new TTSEngine(callbacks, platformConfig);
    engineRef.current = engine;

    // Restore position from saved state
    async function initEngine() {
      const saved = await getReadingState(docId);
      const startIndex = saved?.currentWordIndex ?? 0;

      if (saved?.speed) {
        setSpeed(saved.speed);
      }
      if (saved?.voiceURI) {
        setVoice(saved.voiceURI);
      }

      engine.initialize(words, chapters, startIndex);
      setCurrentWordIndex(startIndex);
      wordIndexRef.current = startIndex;

      if (saved?.speed) {
        engine.setSpeed(saved.speed);
      }
      if (saved?.voiceURI) {
        engine.setVoice(saved.voiceURI);
      }

      initializedRef.current = true;
    }

    initEngine();

    return () => {
      engine.destroy();
      engineRef.current = null;
      initializedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [words, chapters, docId, setPlaybackState, setCurrentWordIndex, debouncedSave, setSpeed, setVoice]);

  // Load voices on mount with Safari fallback
  useEffect(() => {
    loadVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', loadVoices);

      // Safari fallback: voices load late
      if (isSafari()) {
        const timer = setTimeout(loadVoices, 500);
        return () => {
          clearTimeout(timer);
          speechSynthesis.removeEventListener('voiceschanged', loadVoices);
        };
      }

      return () => {
        speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    }
  }, [loadVoices]);

  // Forward speed changes to engine
  useEffect(() => {
    if (engineRef.current && initializedRef.current) {
      engineRef.current.setSpeed(speed);
    }
  }, [speed]);

  // Forward voice changes to engine
  useEffect(() => {
    if (engineRef.current && initializedRef.current && selectedVoiceURI) {
      engineRef.current.setVoice(selectedVoiceURI);
    }
  }, [selectedVoiceURI]);

  // Re-initialize engine when words change (chapter change)
  useEffect(() => {
    if (engineRef.current && initializedRef.current && words.length > 0) {
      const wasPlaying = useAppStore.getState().playbackState === 'playing';
      engineRef.current.initialize(words, chapters, words[0]?.index ?? 0);

      if (useAppStore.getState().speed !== 1) {
        engineRef.current.setSpeed(useAppStore.getState().speed);
      }
      if (useAppStore.getState().selectedVoiceURI) {
        engineRef.current.setVoice(useAppStore.getState().selectedVoiceURI!);
      }

      setCurrentWordIndex(words[0]?.index ?? 0);
      wordIndexRef.current = words[0]?.index ?? 0;

      if (wasPlaying) {
        engineRef.current.play();
      }
    }
    // Only re-run when words identity changes (chapter navigation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  const play = useCallback(() => {
    engineRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    engineRef.current?.play();
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const seekToWord = useCallback((wordIndex: number) => {
    engineRef.current?.seekToWord(wordIndex);
  }, []);

  const skipForward = useCallback((wordCount: number) => {
    engineRef.current?.skipForward(wordCount);
  }, []);

  const skipBackward = useCallback((wordCount: number) => {
    engineRef.current?.skipBackward(wordCount);
  }, []);

  const changeSpeed = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
    },
    [setSpeed],
  );

  const changeVoice = useCallback(
    (voiceURI: string) => {
      setVoice(voiceURI);
    },
    [setVoice],
  );

  return {
    play,
    pause,
    resume,
    stop,
    seekToWord,
    skipForward,
    skipBackward,
    setSpeed: changeSpeed,
    setVoice: changeVoice,
    playbackState,
    currentWordIndex,
    currentChapterIndex,
    availableVoices,
    speed,
    selectedVoiceURI,
  };
}
