'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store';
import type { TTSEngineBase } from '@/engine/tts/TTSEngineBase';
import { createTTSEngine } from '@/engine/tts/createTTSEngine';
import { isSafari } from '@/lib/platformDetector';
import { getReadingState, saveReadingState } from '@/db/readingState';
import { POSITION_SAVE_DEBOUNCE_MS } from '@/lib/constants';
import type { Word, Chapter, ReadingState } from '@/types';
import type { TTSCallbacks } from '@/engine/tts/types';

export function useTTS(words: Word[], chapters: Chapter[], docId: string) {
  const engineRef = useRef<TTSEngineBase | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordIndexRef = useRef(0);
  const initializedRef = useRef(false);
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

  const debouncedSave = useCallback(
    (wordIndex: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
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

  const findChapterForWord = useCallback(
    (wordIndex: number): number => {
      for (let i = 0; i < chapters.length; i++) {
        if (wordIndex >= chapters[i].startWordIndex && wordIndex <= chapters[i].endWordIndex) {
          return i;
        }
      }
      return chapters.length - 1;
    },
    [chapters],
  );

  const syncPosition = useCallback(
    (wordIndex: number) => {
      wordIndexRef.current = wordIndex;
      setCurrentWordIndex(wordIndex);
    },
    [setCurrentWordIndex],
  );

  // ── Effect 1: Engine lifecycle (create on mount, destroy on unmount) ──
  // Only depends on docId — runs once per document, NOT on chapter changes.
  useEffect(() => {
    const callbacks: TTSCallbacks = {
      onWordChange: (wordIndex: number) => {
        wordIndexRef.current = wordIndex;
        setCurrentWordIndex(wordIndex);
        debouncedSave(wordIndex);
      },
      onPlaybackStateChange: (state) => {
        setPlaybackState(state);
      },
      onChunkComplete: () => {},
      onFinished: () => {
        const rs: ReadingState = {
          docId,
          currentWordIndex: wordIndexRef.current,
          currentChapterIndex: useAppStore.getState().currentChapterIndex,
          speed: useAppStore.getState().speed,
          voiceURI: useAppStore.getState().selectedVoiceURI,
          lastReadAt: Date.now(),
          isFinished: true,
        };
        saveReadingState(rs);
      },
      onError: (error: string) => {
        console.error('[TTS Error]', error);
      },
    };

    const engine = createTTSEngine(callbacks);
    engineRef.current = engine;

    return () => {
      // Flush pending save
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Final save
      saveReadingState({
        docId,
        currentWordIndex: wordIndexRef.current,
        currentChapterIndex: useAppStore.getState().currentChapterIndex,
        speed: useAppStore.getState().speed,
        voiceURI: useAppStore.getState().selectedVoiceURI,
        lastReadAt: Date.now(),
        isFinished: false,
      });
      engine.destroy();
      engineRef.current = null;
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // ── Effect 2: Initialize/reinitialize engine when words change ──
  // Runs on first load AND on every chapter change. The engine already exists
  // from Effect 1, so this is always a fast synchronous re-init.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || words.length === 0) return;

    const pending = pendingSeekRef.current;
    pendingSeekRef.current = null;

    if (!initializedRef.current) {
      // First initialization — restore saved state from IndexedDB
      (async () => {
        const saved = await getReadingState(docId);
        let startIndex = pending ? pending.wordIndex : (saved?.currentWordIndex ?? 0);

        // Clamp to current chapter range
        const firstWord = words[0]?.index ?? 0;
        const lastWord = words[words.length - 1]?.index ?? 0;
        if (startIndex < firstWord || startIndex > lastWord) {
          startIndex = firstWord;
        }

        if (saved?.speed) setSpeed(saved.speed);
        if (saved?.voiceURI) setVoice(saved.voiceURI);

        engine.initialize(words, chapters, startIndex);
        syncPosition(startIndex);

        if (saved?.speed) engine.setSpeed(saved.speed);
        if (saved?.voiceURI) engine.setVoice(saved.voiceURI);

        initializedRef.current = true;

        if (pending?.shouldPlay) engine.play();
      })();
    } else {
      // Chapter change — synchronous re-init (no async, no race)
      const startAt = pending ? pending.wordIndex : (words[0]?.index ?? 0);

      // Clamp to current chapter range
      const firstWord = words[0]?.index ?? 0;
      const lastWord = words[words.length - 1]?.index ?? 0;
      const clampedStart = (startAt < firstWord || startAt > lastWord) ? firstWord : startAt;

      engine.initialize(words, chapters, clampedStart);

      const storeState = useAppStore.getState();
      if (storeState.speed !== 1) engine.setSpeed(storeState.speed);
      if (storeState.selectedVoiceURI) engine.setVoice(storeState.selectedVoiceURI);

      syncPosition(clampedStart);

      if (pending?.shouldPlay) engine.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  // ── Effect 3: Load voices ──
  useEffect(() => {
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
      if (isSafari()) {
        const timer = setTimeout(loadVoices, 500);
        return () => { clearTimeout(timer); speechSynthesis.removeEventListener('voiceschanged', loadVoices); };
      }
      return () => { speechSynthesis.removeEventListener('voiceschanged', loadVoices); };
    }
  }, [loadVoices]);

  // ── Effect 4: Forward speed changes ──
  useEffect(() => {
    if (engineRef.current && initializedRef.current) {
      engineRef.current.setSpeed(speed);
    }
  }, [speed]);

  // ── Effect 5: Forward voice changes ──
  useEffect(() => {
    if (engineRef.current && initializedRef.current && selectedVoiceURI) {
      engineRef.current.setVoice(selectedVoiceURI);
    }
  }, [selectedVoiceURI]);

  // ── Actions ──

  const play = useCallback(async () => {
    if (!engineRef.current) return;

    const saved = await getReadingState(docId);
    if (saved?.isFinished) {
      await saveReadingState({ ...saved, isFinished: false, currentWordIndex: 0, currentChapterIndex: 0, lastReadAt: Date.now() });
      const store = useAppStore.getState();
      if (store.currentChapterIndex !== 0) {
        pendingSeekRef.current = { wordIndex: 0, shouldPlay: true };
        await store.setChapter(0);
        return;
      } else {
        engineRef.current.seekToWord(words[0]?.index ?? 0);
        syncPosition(words[0]?.index ?? 0);
      }
    }

    const enginePos = engineRef.current.getCurrentWordIndex();
    syncPosition(enginePos);
    engineRef.current.play();
  }, [docId, words, syncPosition]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    if (engineRef.current) syncPosition(engineRef.current.getCurrentWordIndex());
  }, [syncPosition]);

  const resume = useCallback(() => { engineRef.current?.play(); }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    syncPosition(0);
  }, [syncPosition]);

  const seekToWord = useCallback(
    (wordIndex: number) => {
      const targetChapter = findChapterForWord(wordIndex);
      const store = useAppStore.getState();
      if (targetChapter !== store.currentChapterIndex) {
        pendingSeekRef.current = { wordIndex, shouldPlay: store.playbackState === 'playing' };
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
        pendingSeekRef.current = { wordIndex: targetIndex, shouldPlay: store.playbackState === 'playing' };
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
        pendingSeekRef.current = { wordIndex: targetIndex, shouldPlay: store.playbackState === 'playing' };
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
      if (engineRef.current) syncPosition(engineRef.current.getCurrentWordIndex());
    },
    [setSpeed, syncPosition],
  );

  const changeVoice = useCallback(
    (voiceURI: string) => {
      setVoice(voiceURI);
      if (engineRef.current) syncPosition(engineRef.current.getCurrentWordIndex());
    },
    [setVoice, syncPosition],
  );

  const goToChapter = useCallback(
    (chapterIndex: number) => {
      if (chapterIndex < 0 || chapterIndex >= chapters.length) return;
      const store = useAppStore.getState();
      const wasPlaying = store.playbackState === 'playing';
      engineRef.current?.pause();
      pendingSeekRef.current = { wordIndex: chapters[chapterIndex].startWordIndex, shouldPlay: wasPlaying };
      store.setChapter(chapterIndex);
    },
    [chapters],
  );

  const nextChapter = useCallback(() => {
    const store = useAppStore.getState();
    if (store.currentChapterIndex < chapters.length - 1) goToChapter(store.currentChapterIndex + 1);
  }, [chapters, goToChapter]);

  const prevChapter = useCallback(() => {
    const store = useAppStore.getState();
    if (store.currentChapterIndex > 0) goToChapter(store.currentChapterIndex - 1);
  }, [goToChapter]);

  return {
    play, pause, resume, stop, seekToWord, skipForward, skipBackward,
    setSpeed: changeSpeed, setVoice: changeVoice,
    nextChapter, prevChapter, goToChapter,
    playbackState, currentWordIndex, currentChapterIndex,
    availableVoices, speed, selectedVoiceURI,
    minRate: engineRef.current?.minRate ?? 0.5,
    maxRate: engineRef.current?.maxRate ?? 3.0,
  };
}
