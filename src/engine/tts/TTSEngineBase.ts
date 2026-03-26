import type { Word, Chapter, PlaybackState } from '@/types';
import type { TTSCallbacks, UtteranceChunk } from './types';
import { ChunkBuilder } from './ChunkBuilder';
import { BoundaryTracker } from './BoundaryTracker';
import { WORDS_PER_MINUTE_BASE } from '@/lib/constants';

/**
 * Abstract base class for the TTS engine.
 *
 * Contains all common TTS logic: chunking, utterance management, timers,
 * highlight tracking, and playback control. Platform-specific behavior
 * is defined by protected getters that subclasses override.
 */
export abstract class TTSEngineBase {
  // ─── Platform-specific getters (override in subclasses) ─────────

  /** Whether this platform fires reliable boundary events with charIndex. */
  protected get hasBoundaryEvents(): boolean { return true; }

  /** Whether to use the Safari/Android end-timer fallback for unreliable onend. */
  protected get needsSafariEndTimer(): boolean { return false; }

  /** Minimum speech rate for this platform. */
  get minRate(): number { return 0.5; }

  /** Maximum speech rate for this platform. */
  get maxRate(): number { return 3.0; }

  // ─── Private state ──────────────────────────────────────────────

  private callbacks: TTSCallbacks;

  private words: Word[] = [];
  private chapters: Chapter[] = [];

  private _currentWordIndex = 0;
  private globalIndexOffset = 0;
  private playbackState: PlaybackState = 'idle';

  private chunkBuilder: ChunkBuilder;
  private boundaryTracker: BoundaryTracker;

  private currentChunk: UtteranceChunk | null = null;
  private nextChunk: UtteranceChunk | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  private rate = 1;
  private voiceURI: string | null = null;
  private resolvedVoice: SpeechSynthesisVoice | null = null;

  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private safariEndTimer: ReturnType<typeof setTimeout> | null = null;
  private boundaryFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private utteranceStartTime = 0;
  private useBoundaryEventsFlag = true;

  private documentFinished = false;
  private isDestroyed = false;

  private boundVisibilityHandler: (() => void) | null = null;

  constructor(callbacks: TTSCallbacks) {
    this.callbacks = callbacks;
    this.chunkBuilder = new ChunkBuilder();
    this.boundaryTracker = new BoundaryTracker();
  }

  // ─── Public API ─────────────────────────────────────────────────

  initialize(words: Word[], chapters: Chapter[], startWordIndex?: number): void {
    this.words = words;
    this.chapters = chapters;
    this.globalIndexOffset = words.length > 0 ? words[0].index : 0;
    const globalStart = startWordIndex ?? this.globalIndexOffset;
    this._currentWordIndex = globalStart - this.globalIndexOffset;
    this.documentFinished = false;
    this.setPlaybackState('idle');
    this.setupVisibilityListener();
  }

  play(): void {
    if (this.isDestroyed || this.words.length === 0) return;
    if (!this.isSpeechSynthesisAvailable()) {
      this.callbacks.onError('SpeechSynthesis is not available in this browser.');
      return;
    }

    if (this.documentFinished) {
      this._currentWordIndex = 0;
      this.documentFinished = false;
    }

    this.speakFromCurrentPosition();
  }

  pause(): void {
    if (this.playbackState !== 'playing') return;

    this.clearAllTimers();

    // Use the last reported boundary position and rewind 3 words.
    // Speech is always a few words ahead of the last boundary event,
    // and users prefer re-hearing a couple of words over skipping ahead.
    const REWIND_WORDS = 3;
    const chunkStart = this.currentChunk?.startWordIndex ?? 0;
    const pausePosition = Math.max(chunkStart, this._currentWordIndex - REWIND_WORDS);

    this.getSynth()?.cancel();
    this.currentUtterance = null;

    this._currentWordIndex = pausePosition;
    this.callbacks.onWordChange(pausePosition + this.globalIndexOffset);
    this.setPlaybackState('paused');
  }

  stop(): void {
    this.clearAllTimers();
    this.getSynth()?.cancel();
    this.currentUtterance = null;
    this.currentChunk = null;
    this.nextChunk = null;
    this._currentWordIndex = 0;
    this.documentFinished = false;
    this.useBoundaryEventsFlag = true;
    this.setPlaybackState('idle');
  }

  seekToWord(wordIndex: number): void {
    const wasPlaying = this.playbackState === 'playing';
    const localIndex = wordIndex - this.globalIndexOffset;
    const clamped = Math.max(0, Math.min(localIndex, this.words.length - 1));

    this.clearAllTimers();
    this.getSynth()?.cancel();
    this.currentUtterance = null;
    this._currentWordIndex = clamped;
    this.documentFinished = false;

    this.callbacks.onWordChange(this._currentWordIndex + this.globalIndexOffset);

    if (wasPlaying) {
      this.speakFromCurrentPosition();
    }
  }

  skipForward(wordCount: number): void {
    this.seekToWord(this._currentWordIndex + this.globalIndexOffset + wordCount);
  }

  skipBackward(wordCount: number): void {
    this.seekToWord(this._currentWordIndex + this.globalIndexOffset - wordCount);
  }

  setSpeed(rate: number): void {
    const clamped = Math.max(this.minRate, Math.min(rate, this.maxRate));
    this.rate = clamped;

    if (this.playbackState === 'playing') {
      this.restartFromCurrentPosition();
    }
  }

  setVoice(voiceURI: string): void {
    this.voiceURI = voiceURI;
    this.resolvedVoice = null;

    if (this.playbackState === 'playing') {
      this.restartFromCurrentPosition();
    }
  }

  getCurrentWordIndex(): number {
    return this._currentWordIndex + this.globalIndexOffset;
  }

  isDocumentFinished(): boolean {
    return this.documentFinished;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.clearAllTimers();
    this.getSynth()?.cancel();
    this.currentUtterance = null;
    this.removeVisibilityListener();
    this.setPlaybackState('idle');
  }

  // ─── Protected helpers (available to subclasses) ────────────────

  protected isSpeechSynthesisAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  protected getSynth(): SpeechSynthesis | null {
    if (!this.isSpeechSynthesisAvailable()) return null;
    return window.speechSynthesis;
  }

  // ─── Private implementation ─────────────────────────────────────

  private setPlaybackState(state: PlaybackState): void {
    this.playbackState = state;
    this.callbacks.onPlaybackStateChange(state);
  }

  private speakFromCurrentPosition(): void {
    if (this._currentWordIndex >= this.words.length) {
      this.handleDocumentFinished();
      return;
    }

    this.useBoundaryEventsFlag = this.hasBoundaryEvents;
    this.chunkBuilder = new ChunkBuilder();
    this.currentChunk = this.chunkBuilder.buildChunk(this.words, this._currentWordIndex);
    this.nextChunk = null;

    this.callbacks.onWordChange(this._currentWordIndex + this.globalIndexOffset);
    this.speakChunk(this.currentChunk);
    this.setPlaybackState('playing');
  }

  private restartFromCurrentPosition(): void {
    this.clearAllTimers();
    this.getSynth()?.cancel();
    this.currentUtterance = null;
    this.speakFromCurrentPosition();
  }

  private speakChunk(chunk: UtteranceChunk): void {
    if (this.isDestroyed || chunk.text.length === 0) return;

    const synth = this.getSynth();
    if (!synth) return;

    this.boundaryTracker.setChunk(chunk);
    this.utteranceStartTime = Date.now();

    // Correction #2: Sync highlight to chunk start when a new chunk begins.
    // This corrects any drift from time estimation in the previous chunk.
    this._currentWordIndex = chunk.startWordIndex;
    this.callbacks.onWordChange(chunk.startWordIndex + this.globalIndexOffset);

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = this.rate;

    const voice = this.resolveVoice();
    if (voice) {
      utterance.voice = voice;
    }

    this.currentUtterance = utterance;

    // Guard: only process events from THIS utterance
    utterance.onboundary = (e) => {
      if (this.currentUtterance !== utterance) return;
      this.handleBoundary(e);
    };
    utterance.onend = (e) => {
      if (this.currentUtterance !== utterance) return;
      this.handleUtteranceEnd(e);
    };
    utterance.onerror = (e) => {
      if (this.currentUtterance !== utterance) return;
      this.handleUtteranceError(e);
    };

    this.startWatchdogTimer(chunk);
    if (this.needsSafariEndTimer) {
      this.startSafariEndTimerImpl(chunk);
    }
    this.startBoundaryFallbackTimer();

    synth.speak(utterance);
  }

  private handleBoundary(event: SpeechSynthesisEvent): void {
    if (this.isDestroyed || event.name !== 'word') return;

    const charIndex = event.charIndex;

    if (!this.boundaryTracker.validateCharIndex(charIndex)) {
      this.useBoundaryEventsFlag = false;
      return;
    }

    const wordIndex = this.boundaryTracker.resolveWordIndex(charIndex);
    this._currentWordIndex = wordIndex;
    this.callbacks.onWordChange(wordIndex + this.globalIndexOffset);

    this.clearBoundaryFallbackTimer();
    this.startBoundaryFallbackTimer();

    if (this.currentChunk && !this.nextChunk) {
      const chunkWordCount = this.currentChunk.endWordIndex - this.currentChunk.startWordIndex + 1;
      const progress = wordIndex - this.currentChunk.startWordIndex;
      if (progress >= chunkWordCount * 0.5) {
        this.nextChunk = this.chunkBuilder.buildNextChunk(this.words, this.currentChunk);
      }
    }
  }

  private handleUtteranceEnd(_event: SpeechSynthesisEvent): void {
    if (this.isDestroyed) return;

    this.clearAllTimers();

    if (this.playbackState !== 'playing') return;

    const finishedChunk = this.currentChunk;
    if (finishedChunk) {
      // Correction #1: Force-sync position to chunk end.
      // Time estimation may have drifted during the chunk — this snaps
      // the highlight to the exact correct position before advancing.
      this._currentWordIndex = finishedChunk.endWordIndex + 1;
      this.callbacks.onWordChange(finishedChunk.endWordIndex + this.globalIndexOffset);
      this.callbacks.onChunkComplete(finishedChunk.endWordIndex + this.globalIndexOffset);
    }

    if (this._currentWordIndex >= this.words.length) {
      this.handleDocumentFinished();
      return;
    }

    const next = this.nextChunk ?? this.chunkBuilder.buildChunk(this.words, this._currentWordIndex);
    this.currentChunk = next;
    this.nextChunk = null;
    this.speakChunk(next);
  }

  private handleUtteranceError(event: SpeechSynthesisErrorEvent): void {
    if (this.isDestroyed) return;
    this.clearAllTimers();

    if (event.error === 'interrupted' || event.error === 'canceled') {
      return;
    }

    this.callbacks.onError(`Speech synthesis error: ${event.error}`);
    this.setPlaybackState('idle');
  }

  private handleDocumentFinished(): void {
    this.documentFinished = true;
    this.currentUtterance = null;
    this.currentChunk = null;
    this.nextChunk = null;
    this.setPlaybackState('idle');
    this.callbacks.onFinished();
  }

  // ─── Voice Resolution ───────────────────────────────────────────

  private resolveVoice(): SpeechSynthesisVoice | null {
    if (this.resolvedVoice) return this.resolvedVoice;
    if (!this.voiceURI) return null;

    const synth = this.getSynth();
    if (!synth) return null;

    const voices = synth.getVoices();
    const match = voices.find((v) => v.voiceURI === this.voiceURI);
    if (match) {
      this.resolvedVoice = match;
    }
    return this.resolvedVoice;
  }

  // ─── Timers ─────────────────────────────────────────────────────

  private startWatchdogTimer(chunk: UtteranceChunk): void {
    this.clearWatchdogTimer();
    const wordCount = chunk.endWordIndex - chunk.startWordIndex + 1;
    const expectedMs = (wordCount / (this.rate * 2.5)) * 1000;
    const timeout = expectedMs * 3 + 5000;

    this.watchdogTimer = setTimeout(() => {
      if (this.playbackState === 'playing' && !this.isDestroyed) {
        this.getSynth()?.cancel();
        this.currentUtterance = null;
        this.speakFromCurrentPosition();
      }
    }, timeout);
  }

  private startSafariEndTimerImpl(chunk: UtteranceChunk): void {
    this.clearSafariEndTimer();
    const timeout = (chunk.text.length * 100 / this.rate) + 5000;

    this.safariEndTimer = setTimeout(() => {
      if (this.playbackState === 'playing' && !this.isDestroyed) {
        this.getSynth()?.cancel();
        this.currentUtterance = null;

        if (this.currentChunk) {
          this._currentWordIndex = this.currentChunk.endWordIndex + 1;
          this.callbacks.onChunkComplete(this.currentChunk.endWordIndex + this.globalIndexOffset);
        }

        if (this._currentWordIndex >= this.words.length) {
          this.handleDocumentFinished();
        } else {
          this.speakFromCurrentPosition();
        }
      }
    }, timeout);
  }

  private startBoundaryFallbackTimer(): void {
    if (!this.useBoundaryEventsFlag) return;

    this.clearBoundaryFallbackTimer();
    this.boundaryFallbackTimer = setTimeout(() => {
      if (this.playbackState === 'playing' && !this.isDestroyed) {
        this.useBoundaryEventsFlag = false;
        this.startTimeEstimationLoop();
      }
    }, 500);
  }

  private startTimeEstimationLoop(): void {
    if (this.isDestroyed || this.playbackState !== 'playing') return;

    const estimate = this.boundaryTracker.estimateWordIndex(
      Date.now() - this.utteranceStartTime,
      this.rate,
    );

    if (estimate !== this._currentWordIndex && estimate <= (this.currentChunk?.endWordIndex ?? 0)) {
      this._currentWordIndex = estimate;
      this.callbacks.onWordChange(estimate + this.globalIndexOffset);
    }

    this.boundaryFallbackTimer = setTimeout(() => {
      this.startTimeEstimationLoop();
    }, 200);
  }

  private clearWatchdogTimer(): void {
    if (this.watchdogTimer !== null) { clearTimeout(this.watchdogTimer); this.watchdogTimer = null; }
  }

  private clearSafariEndTimer(): void {
    if (this.safariEndTimer !== null) { clearTimeout(this.safariEndTimer); this.safariEndTimer = null; }
  }

  private clearBoundaryFallbackTimer(): void {
    if (this.boundaryFallbackTimer !== null) { clearTimeout(this.boundaryFallbackTimer); this.boundaryFallbackTimer = null; }
  }

  private clearAllTimers(): void {
    this.clearWatchdogTimer();
    this.clearSafariEndTimer();
    this.clearBoundaryFallbackTimer();
  }

  // ─── Visibility Change ──────────────────────────────────────────

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;
    this.removeVisibilityListener();

    this.boundVisibilityHandler = () => {
      if (document.hidden && this.playbackState === 'playing') {
        this.pause();
      }
    };

    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
  }

  private removeVisibilityListener(): void {
    if (typeof document === 'undefined') return;
    if (this.boundVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
  }
}
