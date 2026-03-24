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

  // Pending seek: when we need to switch chapters then seek, store the target here.
  // The useEffect that watches `words` will pick it up after chapter loads.
  const pendingSeekRef = useRef<{ wordIndex: number; shouldPlay: boolean } | null>(null);

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

  // Helper: find which chapter a global word index belongs to
  const findChapterForWord = useCallback(
    (wordIndex: number): number => {
      for (let i = 0; i < chapters.length; i++) {
        if (wordIndex >= chapters[i].startWordIndex && wordIndex <= chapters[i].endWordIndex) {
          return i;
        }
      }
      // If beyond last chapter, return last chapter
      return chapters.length - 1;
    },
    [chapters],
  );

  // Helper: sync highlight position immediately
  const syncPosition = useCallback(
    (wordIndex: number) => {
      wordIndexRef.current = wordIndex;
      setCurrentWordIndex(wordIndex);
    },
    [setCurrentWordIndex],
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
      // Check for a pending seek (e.g. cross-chapter skip) before reading
      // saved state. The pending seek takes priority because the user just
      // requested it, and the saved position may reference a different chapter.
      const pending = pendingSeekRef.current;
      pendingSeekRef.current = null;

      const saved = await getReadingState(docId);
      let startIndex: number;

      if (pending) {
        startIndex = pending.wordIndex;
      } else {
        startIndex = saved?.currentWordIndex ?? 0;
      }

      // Ensure startIndex falls within the current chapter's word range.
      // When a chapter changes, the saved position may belong to a different
      // chapter whose words are no longer loaded in the DOM.
      const firstWordIndex = words[0]?.index ?? 0;
      const lastWordIndex = words[words.length - 1]?.index ?? 0;
      if (startIndex < firstWordIndex || startIndex > lastWordIndex) {
        startIndex = firstWordIndex;
      }

      if (saved?.speed) {
        setSpeed(saved.speed);
      }
      if (saved?.voiceURI) {
        setVoice(saved.voiceURI);
      }

      engine.initialize(words, chapters, startIndex);
      syncPosition(startIndex);

      if (saved?.speed) {
        engine.setSpeed(saved.speed);
      }
      if (saved?.voiceURI) {
        engine.setVoice(saved.voiceURI);
      }

      initializedRef.current = true;

      if (pending?.shouldPlay) {
        engine.play();
      }
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
  }, [words, chapters, docId, setPlaybackState, setCurrentWordIndex, debouncedSave, setSpeed, setVoice, syncPosition]);

  // Load voices on mount with Safari fallback
  useEffect(() => {
    loadVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', loadVoices);

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

  // Re-initialize engine when words change (chapter change).
  // Also apply any pending seek that was queued before the chapter loaded.
  useEffect(() => {
    if (engineRef.current && initializedRef.current && words.length > 0) {
      const pending = pendingSeekRef.current;
      pendingSeekRef.current = null;

      const startAt = pending ? pending.wordIndex : (words[0]?.index ?? 0);

      engineRef.current.initialize(words, chapters, startAt);

      if (useAppStore.getState().speed !== 1) {
        engineRef.current.setSpeed(useAppStore.getState().speed);
      }
      if (useAppStore.getState().selectedVoiceURI) {
        engineRef.current.setVoice(useAppStore.getState().selectedVoiceURI!);
      }

      syncPosition(startAt);

      if (pending?.shouldPlay) {
        engineRef.current.play();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  const play = useCallback(async () => {
    // If the document is finished, reset to beginning
    const saved = await getReadingState(docId);
    if (saved?.isFinished && engineRef.current) {
      const resetState: ReadingState = {
        ...saved,
        isFinished: false,
        currentWordIndex: 0,
        currentChapterIndex: 0,
        lastReadAt: Date.now(),
      };
      await saveReadingState(resetState);

      const store = useAppStore.getState();
      if (store.currentChapterIndex !== 0) {
        pendingSeekRef.current = { wordIndex: 0, shouldPlay: true };
        await store.setChapter(0);
        return; // useEffect on words change will handle play
      } else {
        engineRef.current.seekToWord(words[0]?.index ?? 0);
        syncPosition(words[0]?.index ?? 0);
      }
    }
    engineRef.current?.play();
  }, [docId, words, syncPosition]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    // Engine's pause() now calls onWordChange, but also sync here for safety
    if (engineRef.current) {
      syncPosition(engineRef.current.getCurrentWordIndex());
    }
  }, [syncPosition]);

  const resume = useCallback(() => {
    engineRef.current?.play();
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    syncPosition(0);
  }, [syncPosition]);

  const seekToWord = useCallback(
    (wordIndex: number) => {
      const targetChapter = findChapterForWord(wordIndex);
      const store = useAppStore.getState();

      if (targetChapter !== store.currentChapterIndex) {
        // Queue the seek and switch chapters — useEffect will apply it
        pendingSeekRef.current = {
          wordIndex,
          shouldPlay: store.playbackState === 'playing',
        };
        // Pause first so we don't have stale playback
        engineRef.current?.pause();
        store.setChapter(targetChapter);
      } else {
        engineRef.current?.seekToWord(wordIndex);
        syncPosition(wordIndex);
      }
    },
    [findChapterForWord, syncPosition],
  );

  const skipForward = useCallback(
    (wordCount: number) => {
      const currentIdx = engineRef.current?.getCurrentWordIndex() ?? 0;
      const targetIndex = Math.min(currentIdx + wordCount, (chapters[chapters.length - 1]?.endWordIndex ?? 0));
      const targetChapter = findChapterForWord(targetIndex);
      const store = useAppStore.getState();

      if (targetChapter !== store.currentChapterIndex) {
        pendingSeekRef.current = {
          wordIndex: targetIndex,
          shouldPlay: store.playbackState === 'playing',
        };
        engineRef.current?.pause();
        store.setChapter(targetChapter);
      } else {
        engineRef.current?.seekToWord(targetIndex);
        syncPosition(targetIndex);
      }
    },
    [chapters, findChapterForWord, syncPosition],
  );

  const skipBackward = useCallback(
    (wordCount: number) => {
      const currentIdx = engineRef.current?.getCurrentWordIndex() ?? 0;
      const targetIndex = Math.max(currentIdx - wordCount, 0);
      const targetChapter = findChapterForWord(targetIndex);
      const store = useAppStore.getState();

      if (targetChapter !== store.currentChapterIndex) {
        pendingSeekRef.current = {
          wordIndex: targetIndex,
          shouldPlay: store.playbackState === 'playing',
        };
        engineRef.current?.pause();
        store.setChapter(targetChapter);
      } else {
        engineRef.current?.seekToWord(targetIndex);
        syncPosition(targetIndex);
      }
    },
    [findChapterForWord, syncPosition],
  );

  const changeSpeed = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
      // Speed change restarts utterance in engine, confirm position
      if (engineRef.current) {
        syncPosition(engineRef.current.getCurrentWordIndex());
      }
    },
    [setSpeed, syncPosition],
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
