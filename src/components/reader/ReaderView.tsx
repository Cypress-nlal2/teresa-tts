'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAppStore } from '@/store';
import { useTTS } from '@/hooks/useTTS';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Header } from '@/components/shared/Header';
import { TextDisplay } from './TextDisplay';
import { PlayerControls } from './PlayerControls';
import { ChapterNav } from './ChapterNav';
import type { DocumentMeta } from '@/types';

interface ReaderViewProps {
  document: DocumentMeta;
}

export function ReaderView({ document: doc }: ReaderViewProps) {
  const [chapterNavOpen, setChapterNavOpen] = useState(false);
  const [noTTSAvailable, setNoTTSAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !('speechSynthesis' in window)) {
      setNoTTSAvailable(true);
    }
  }, []);

  const currentChapterWords = useAppStore((s) => s.currentChapterWords);
  const currentChapterIndex = useAppStore((s) => s.currentChapterIndex);
  const touchGuardEnabled = useAppStore((s) => s.touchGuardEnabled);
  const toggleTouchGuard = useAppStore((s) => s.toggleTouchGuard);
  const setChapter = useAppStore((s) => s.setChapter);

  const {
    play,
    pause,
    seekToWord,
    skipForward,
    skipBackward,
    setSpeed,
    setVoice,
    nextChapter,
    prevChapter,
    goToChapter,
    playbackState,
    currentWordIndex,
    availableVoices,
    speed,
    selectedVoiceURI,
    minRate,
    maxRate,
  } = useTTS(currentChapterWords, doc.chapters, doc.id);

  const handleNextChapter = nextChapter;
  const handlePrevChapter = prevChapter;
  const handleChapterSelect = goToChapter;

  const handleTogglePlayPause = useCallback(() => {
    if (playbackState === 'playing') {
      pause();
    } else {
      play();
    }
  }, [playbackState, play, pause]);

  const handleSpeedUp = useCallback(() => {
    setSpeed(Math.round((speed + 0.1) * 10) / 10);
  }, [speed, setSpeed]);

  const handleSpeedDown = useCallback(() => {
    setSpeed(Math.round((speed - 0.1) * 10) / 10);
  }, [speed, setSpeed]);

  const handleSkipForward = useCallback(
    (count: number) => skipForward(count),
    [skipForward],
  );

  const handleSkipBackward = useCallback(
    (count: number) => skipBackward(count),
    [skipBackward],
  );

  const keyboardActions = useMemo(
    () => ({
      togglePlayPause: handleTogglePlayPause,
      skipForward: () => skipForward(75),
      skipBackward: () => skipBackward(25),
      speedUp: handleSpeedUp,
      speedDown: handleSpeedDown,
      nextChapter: handleNextChapter,
      prevChapter: handlePrevChapter,
    }),
    [handleTogglePlayPause, skipForward, skipBackward, handleSpeedUp, handleSpeedDown, handleNextChapter, handlePrevChapter],
  );

  useKeyboardShortcuts(keyboardActions);

  return (
    <div className="flex flex-col h-dvh">
      <Header showBack />

      {noTTSAvailable && (
        <div role="alert" className="mx-4 mt-2 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Text-to-speech is not available in this browser. Please use a supported browser (Chrome, Safari, Edge, or Firefox).
        </div>
      )}

      <TextDisplay
        words={currentChapterWords}
        chapters={doc.chapters}
        currentChapterIndex={currentChapterIndex}
        currentWordIndex={currentWordIndex}
        onSeekToWord={seekToWord}
        touchGuardEnabled={touchGuardEnabled}
        onDisableTouchGuard={toggleTouchGuard}
      />

      <PlayerControls
        playbackState={playbackState}
        currentWordIndex={currentWordIndex}
        totalWords={doc.totalWords}
        speed={speed}
        chapters={doc.chapters}
        currentChapterIndex={currentChapterIndex}
        availableVoices={availableVoices}
        selectedVoiceURI={selectedVoiceURI}
        touchGuardEnabled={touchGuardEnabled}
        onPlay={play}
        onPause={pause}
        onSeekToWord={seekToWord}
        onSkipForward={handleSkipForward}
        onSkipBackward={handleSkipBackward}
        onNextChapter={handleNextChapter}
        onPrevChapter={handlePrevChapter}
        onSpeedChange={setSpeed}
        onVoiceChange={setVoice}
        onToggleTouchGuard={toggleTouchGuard}
        onChapterTitleClick={() => setChapterNavOpen(true)}
        minRate={minRate}
        maxRate={maxRate}
      />

      <ChapterNav
        chapters={doc.chapters}
        currentChapterIndex={currentChapterIndex}
        onChapterSelect={handleChapterSelect}
        open={chapterNavOpen}
        onClose={() => setChapterNavOpen(false)}
      />
    </div>
  );
}
