'use client';

import { useState, useCallback, useMemo } from 'react';
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
    playbackState,
    currentWordIndex,
    availableVoices,
    speed,
    selectedVoiceURI,
  } = useTTS(currentChapterWords, doc.chapters, doc.id);

  const handleNextChapter = useCallback(() => {
    if (currentChapterIndex < doc.chapters.length - 1) {
      setChapter(currentChapterIndex + 1);
    }
  }, [currentChapterIndex, doc.chapters.length, setChapter]);

  const handlePrevChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      setChapter(currentChapterIndex - 1);
    }
  }, [currentChapterIndex, setChapter]);

  const handleChapterSelect = useCallback(
    (index: number) => {
      setChapter(index);
    },
    [setChapter],
  );

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
