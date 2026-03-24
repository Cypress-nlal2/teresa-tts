'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import type { Chapter, PlaybackState } from '@/types';
import {
  SKIP_FORWARD_WORDS,
  SKIP_BACKWARD_WORDS,
  WORDS_PER_MINUTE_BASE,
} from '@/lib/constants';
import { getPlatformTTSStrategy } from '@/lib/platformDetector';
import { SpeedControl } from './SpeedControl';
import { VoiceSelector } from './VoiceSelector';

interface PlayerControlsProps {
  playbackState: PlaybackState;
  currentWordIndex: number;
  totalWords: number;
  speed: number;
  chapters: Chapter[];
  currentChapterIndex: number;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceURI: string | null;
  touchGuardEnabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeekToWord: (wordIndex: number) => void;
  onSkipForward: (count: number) => void;
  onSkipBackward: (count: number) => void;
  onNextChapter: () => void;
  onPrevChapter: () => void;
  onSpeedChange: (speed: number) => void;
  onVoiceChange: (uri: string) => void;
  onToggleTouchGuard: () => void;
  onChapterTitleClick: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlayerControls({
  playbackState,
  currentWordIndex,
  totalWords,
  speed,
  chapters,
  currentChapterIndex,
  availableVoices,
  selectedVoiceURI,
  touchGuardEnabled,
  onPlay,
  onPause,
  onSeekToWord,
  onSkipForward,
  onSkipBackward,
  onNextChapter,
  onPrevChapter,
  onSpeedChange,
  onVoiceChange,
  onToggleTouchGuard,
  onChapterTitleClick,
}: PlayerControlsProps) {
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const platform = useMemo(() => getPlatformTTSStrategy(), []);

  const progress = totalWords > 0 ? currentWordIndex / totalWords : 0;

  const wordsRemaining = totalWords - currentWordIndex;
  const wpm = WORDS_PER_MINUTE_BASE * speed;
  const elapsedSeconds = (currentWordIndex / wpm) * 60;
  const totalSeconds = (totalWords / wpm) * 60;

  const currentChapterTitle = chapters[currentChapterIndex]?.title ?? 'Untitled';

  const isPlaying = playbackState === 'playing';

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [isPlaying, onPlay, onPause]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const wordIndex = Math.round(ratio * totalWords);
      onSeekToWord(wordIndex);
    },
    [totalWords, onSeekToWord],
  );

  const handleProgressDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const bar = e.currentTarget;
      bar.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        const wordIndex = Math.round(ratio * totalWords);
        onSeekToWord(wordIndex);
      };

      const onUp = () => {
        bar.removeEventListener('pointermove', onMove);
        bar.removeEventListener('pointerup', onUp);
      };

      bar.addEventListener('pointermove', onMove);
      bar.addEventListener('pointerup', onUp);
    },
    [totalWords, onSeekToWord],
  );

  return (
    <div className="safe-bottom sticky bottom-0 z-30 border-t border-border bg-surface/80 backdrop-blur-lg">
      {/* Popover panels */}
      <div className="relative px-4">
        {showSpeedControl && (
          <SpeedControl
            speed={speed}
            onSpeedChange={onSpeedChange}
            minSpeed={platform.minRate}
            maxSpeed={platform.maxRate}
            onClose={() => setShowSpeedControl(false)}
          />
        )}
        {showVoiceSelector && (
          <VoiceSelector
            voices={availableVoices}
            selectedVoiceURI={selectedVoiceURI}
            onVoiceChange={onVoiceChange}
            onClose={() => setShowVoiceSelector(false)}
          />
        )}
      </div>

      {/* Progress bar */}
      <div
        ref={progressRef}
        className="h-3 cursor-pointer group px-0"
        onClick={handleProgressClick}
        onPointerDown={handleProgressDrag}
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      >
        <div className="relative h-full bg-border/50">
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-150"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress * 100}% - 8px)` }}
          />
        </div>
      </div>

      <div className="px-4 pb-2 pt-1">
        {/* Info row */}
        <div className="flex items-center justify-between mb-2 min-h-[24px]">
          <button
            type="button"
            onClick={onChapterTitleClick}
            className="text-xs text-muted truncate max-w-[40%] hover:text-foreground transition-colors text-left"
          >
            {currentChapterTitle}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted tabular-nums">
              {formatTime(elapsedSeconds)} / {formatTime(totalSeconds)}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowVoiceSelector(false);
                setShowSpeedControl(!showSpeedControl);
              }}
              className="text-xs text-muted hover:text-foreground transition-colors font-medium tabular-nums"
            >
              {speed.toFixed(1)}x
            </button>
          </div>
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {/* Previous chapter */}
          <button
            type="button"
            onClick={onPrevChapter}
            disabled={currentChapterIndex === 0}
            className="h-11 w-11 flex items-center justify-center rounded-full text-muted hover:text-foreground disabled:opacity-30 transition-colors"
            aria-label="Previous chapter"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </button>

          {/* Skip backward */}
          <button
            type="button"
            onClick={() => onSkipBackward(SKIP_BACKWARD_WORDS)}
            className="h-11 w-11 flex items-center justify-center rounded-full text-muted hover:text-foreground transition-colors"
            aria-label="Skip backward"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 19 2 12 11 5 11 19" />
              <polygon points="22 19 13 12 22 5 22 19" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={playbackState === 'loading'}
            className="h-14 w-14 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-md"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {playbackState === 'loading' ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            )}
          </button>

          {/* Skip forward */}
          <button
            type="button"
            onClick={() => onSkipForward(SKIP_FORWARD_WORDS)}
            className="h-11 w-11 flex items-center justify-center rounded-full text-muted hover:text-foreground transition-colors"
            aria-label="Skip forward"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 19 22 12 13 5 13 19" />
              <polygon points="2 19 11 12 2 5 2 19" />
            </svg>
          </button>

          {/* Next chapter */}
          <button
            type="button"
            onClick={onNextChapter}
            disabled={currentChapterIndex >= chapters.length - 1}
            className="h-11 w-11 flex items-center justify-center rounded-full text-muted hover:text-foreground disabled:opacity-30 transition-colors"
            aria-label="Next chapter"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        </div>

        {/* Bottom controls row */}
        <div className="flex items-center justify-center gap-2">
          {/* Voice button */}
          <button
            type="button"
            onClick={() => {
              setShowSpeedControl(false);
              setShowVoiceSelector(!showVoiceSelector);
            }}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label="Select voice"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            Voice
          </button>

          {/* Speed button */}
          <button
            type="button"
            onClick={() => {
              setShowVoiceSelector(false);
              setShowSpeedControl(!showSpeedControl);
            }}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label="Adjust speed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Speed
          </button>

          {/* Touch guard toggle */}
          <button
            type="button"
            onClick={onToggleTouchGuard}
            className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs transition-colors
              ${
                touchGuardEnabled
                  ? 'text-primary bg-primary/10'
                  : 'text-muted hover:text-foreground hover:bg-surface-hover'
              }`}
            aria-label={touchGuardEnabled ? 'Disable touch guard' : 'Enable touch guard'}
            aria-pressed={touchGuardEnabled}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Touch
          </button>
        </div>
      </div>
    </div>
  );
}
