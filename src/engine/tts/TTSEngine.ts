import type { Word, Chapter, PlaybackState } from '@/types';
import type { TTSCallbacks, PlatformTTSConfig, UtteranceChunk } from './types';
import { ChunkBuilder } from './ChunkBuilder';
import { BoundaryTracker } from './BoundaryTracker';
import { WORDS_PER_MINUTE_BASE } from '@/lib/constants';

export class TTSEngine {
  private callbacks: TTSCallbacks;
  private platformConfig: PlatformTTSConfig;

  private words: Word[] = [];
  private chapters: Chapter[] = [];

  private currentWordIndex = 0;
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
  private useBoundaryEvents = true;

  private documentFinished = false;
  private isDestroyed = false;

  private boundVisibilityHandler: (() => void) | null = null;

  constructor(callbacks: TTSCallbacks, platformConfig: PlatformTTSConfig) {
    this.callbacks = callbacks;
    this.platformConfig = platformConfig;
    this.chunkBuilder = new ChunkBuilder();
    this.boundaryTracker = new BoundaryTracker();
  }

  /**
   * Load document data and optionally set a starting word index.
   */
  initialize(words: Word[], chapters: Chapter[], startWordIndex?: number): void {
    this.words = words;
    this.chapters = chapters;
    this.currentWordIndex = startWordIndex ?? 0;
    this.documentFinished = false;
    this.setPlaybackState('idle');
    this.setupVisibilityListener();
  }

  /**
   * Start or resume playback.
   */
  play(): void {
    if (this.isDestroyed || this.words.length === 0) return;
    if (!this.isSpeechSynthesisAvailable()) {
      this.callbacks.onError('SpeechSynthesis is not available in this browser.');
      return;
    }

    if (this.documentFinished) {
      // Restart from beginning if finished
      this.currentWordIndex = 0;
      this.documentFinished = false;
    }

    if (this.playbackState === 'paused' && !this.platformConfig.useCancelForPause) {
      // Desktop resume via speechSynthesis.resume()
      this.getSynth()?.resume();
      this.setPlaybackState('playing');
      // Confirm position and restart tracking
      this.callbacks.onWordChange(this.currentWordIndex);
      this.utteranceStartTime = Date.now();
      this.startBoundaryFallbackTimer();
      return;
    }

    // Start fresh or resume from saved position (cancel-for-pause strategy)
    this.speakFromCurrentPosition();
  }

  /**
   * Pause playback using the platform-appropriate strategy.
   */
  pause(): void {
    if (this.playbackState !== 'playing') return;

    this.clearAllTimers();

    if (this.platformConfig.useCancelForPause) {
      // Cancel-for-pause: save position and cancel
      this.getSynth()?.cancel();
      this.currentUtterance = null;
    } else {
      this.getSynth()?.pause();
    }

    // Always confirm current position on pause so highlight stays in sync
    this.callbacks.onWordChange(this.currentWordIndex);
    this.setPlaybackState('paused');
  }

  /**
   * Stop playback and reset to beginning.
   */
  stop(): void {
    this.clearAllTimers();
    this.getSynth()?.cancel();
    this.currentUtterance = null;
    this.currentChunk = null;
    this.nextChunk = null;
    this.currentWordIndex = 0;
    this.documentFinished = false;
    this.useBoundaryEvents = true;
    this.setPlaybackState('idle');
  }

  /**
   * Jump to a specific word and resume if playing.
   */
  seekToWord(wordIndex: number): void {
    const wasPlaying = this.playbackState === 'playing';
    const clamped = Math.max(0, Math.min(wordIndex, this.words.length - 1));

    this.clearAllTimers();
    this.getSynth()?.cancel();
    this.currentUtterance = null;
    this.currentWordIndex = clamped;
    this.documentFinished = false;

    this.callbacks.onWordChange(this.currentWordIndex);

    if (wasPlaying) {
      this.speakFromCurrentPosition();
    }
  }

  /**
   * Skip forward by wordCount words, clamped to end.
   */
  skipForward(wordCount: number): void {
    this.seekToWord(this.currentWordIndex + wordCount);
  }

  /**
   * Skip backward by wordCount words, clamped to start.
   */
  skipBackward(wordCount: number): void {
    this.seekToWord(this.currentWordIndex - wordCount);
  }

  /**
   * Change playback speed. Restarts utterance if currently playing.
   */
  setSpeed(rate: number): void {
    const clamped = Math.max(
      this.platformConfig.minRate,
      Math.min(rate, this.platformConfig.maxRate)
    );
    this.rate = clamped;

    if (this.playbackState === 'playing') {
      this.restartFromCurrentPosition();
    }
  }

  /**
   * Change voice. Restarts utterance if currently playing.
   */
  setVoice(voiceURI: string): void {
    this.voiceURI = voiceURI;
    this.resolvedVoice = null; // Force re-resolution

    if (this.playbackState === 'playing') {
      this.restartFromCurrentPosition();
    }
  }

  getCurrentWordIndex(): number {
    return this.currentWordIndex;
  }

  isDocumentFinished(): boolean {
    return this.documentFinished;
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.isDestroyed = true;
    this.clearAllTimers();
    this.getSynth()?.cancel();
    this.currentUtterance = null;
    this.removeVisibilityListener();
    this.setPlaybackState('idle');
  }

  // ─── Private Methods ────────────────────────────────────────────

  private isSpeechSynthesisAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  private getSynth(): SpeechSynthesis | null {
    if (!this.isSpeechSynthesisAvailable()) return null;
    return window.speechSynthesis;
  }

  private setPlaybackState(state: PlaybackState): void {
    this.playbackState = state;
    this.callbacks.onPlaybackStateChange(state);
  }

  private speakFromCurrentPosition(): void {
    if (this.currentWordIndex >= this.words.length) {
      this.handleDocumentFinished();
      return;
    }

    this.useBoundaryEvents = this.platformConfig.hasBoundaryEvents;
    this.chunkBuilder = new ChunkBuilder(); // Reset chunk IDs for clean state
    this.currentChunk = this.chunkBuilder.buildChunk(this.words, this.currentWordIndex);
    this.nextChunk = null;

    // Confirm position before speaking so highlight is immediately correct
    this.callbacks.onWordChange(this.currentWordIndex);
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

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = this.rate;

    // Resolve voice
    const voice = this.resolveVoice();
    if (voice) {
      utterance.voice = voice;
    }

    // Keep strong reference to prevent GC
    this.currentUtterance = utterance;

    utterance.onboundary = this.handleBoundary.bind(this);
    utterance.onend = this.handleUtteranceEnd.bind(this);
    utterance.onerror = this.handleUtteranceError.bind(this);

    // Start timers
    this.startWatchdogTimer(chunk);
    this.startSafariEndTimer(chunk);
    this.startBoundaryFallbackTimer();

    synth.speak(utterance);
  }

  private handleBoundary(event: SpeechSynthesisEvent): void {
    if (this.isDestroyed || event.name !== 'word') return;

    const charIndex = event.charIndex;

    if (!this.boundaryTracker.validateCharIndex(charIndex)) {
      // Switch to time-based estimation
      this.useBoundaryEvents = false;
      return;
    }

    const wordIndex = this.boundaryTracker.resolveWordIndex(charIndex);
    this.currentWordIndex = wordIndex;
    this.callbacks.onWordChange(wordIndex);

    // Reset boundary fallback timer since we got an event
    this.clearBoundaryFallbackTimer();
    this.startBoundaryFallbackTimer();

    // Pre-build next chunk when ~50% through current chunk
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
      this.currentWordIndex = finishedChunk.endWordIndex + 1;
      this.callbacks.onChunkComplete(finishedChunk.endWordIndex);
    }

    // Check if document is finished
    if (this.currentWordIndex >= this.words.length) {
      this.handleDocumentFinished();
      return;
    }

    // Speak next chunk immediately (no setTimeout)
    const next = this.nextChunk ?? this.chunkBuilder.buildChunk(this.words, this.currentWordIndex);
    this.currentChunk = next;
    this.nextChunk = null;
    this.speakChunk(next);
  }

  private handleUtteranceError(event: SpeechSynthesisErrorEvent): void {
    if (this.isDestroyed) return;
    this.clearAllTimers();

    // 'interrupted' and 'canceled' are expected during pause/seek/stop
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
        // Watchdog fired: cancel and restart from last known position
        this.getSynth()?.cancel();
        this.currentUtterance = null;
        this.speakFromCurrentPosition();
      }
    }, timeout);
  }

  private startSafariEndTimer(chunk: UtteranceChunk): void {
    this.clearSafariEndTimer();

    // Only use Safari end timer on platforms that use cancel-for-pause (Safari/Android)
    if (!this.platformConfig.useCancelForPause) return;

    const timeout = chunk.text.length * 100 + 5000;

    this.safariEndTimer = setTimeout(() => {
      if (this.playbackState === 'playing' && !this.isDestroyed) {
        // Force-advance: onend hasn't fired
        this.getSynth()?.cancel();
        this.currentUtterance = null;

        if (this.currentChunk) {
          this.currentWordIndex = this.currentChunk.endWordIndex + 1;
          this.callbacks.onChunkComplete(this.currentChunk.endWordIndex);
        }

        if (this.currentWordIndex >= this.words.length) {
          this.handleDocumentFinished();
        } else {
          this.speakFromCurrentPosition();
        }
      }
    }, timeout);
  }

  private startBoundaryFallbackTimer(): void {
    if (!this.useBoundaryEvents) return;

    this.clearBoundaryFallbackTimer();
    this.boundaryFallbackTimer = setTimeout(() => {
      if (this.playbackState === 'playing' && !this.isDestroyed) {
        // No boundary event for 500ms, switch to time estimation
        this.useBoundaryEvents = false;
        this.startTimeEstimationLoop();
      }
    }, 500);
  }

  private startTimeEstimationLoop(): void {
    if (this.isDestroyed || this.playbackState !== 'playing') return;

    const estimate = this.boundaryTracker.estimateWordIndex(
      Date.now() - this.utteranceStartTime,
      this.rate
    );

    if (estimate !== this.currentWordIndex && estimate <= (this.currentChunk?.endWordIndex ?? 0)) {
      this.currentWordIndex = estimate;
      this.callbacks.onWordChange(estimate);
    }

    // Continue estimating every 200ms
    this.boundaryFallbackTimer = setTimeout(() => {
      this.startTimeEstimationLoop();
    }, 200);
  }

  private clearWatchdogTimer(): void {
    if (this.watchdogTimer !== null) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private clearSafariEndTimer(): void {
    if (this.safariEndTimer !== null) {
      clearTimeout(this.safariEndTimer);
      this.safariEndTimer = null;
    }
  }

  private clearBoundaryFallbackTimer(): void {
    if (this.boundaryFallbackTimer !== null) {
      clearTimeout(this.boundaryFallbackTimer);
      this.boundaryFallbackTimer = null;
    }
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
