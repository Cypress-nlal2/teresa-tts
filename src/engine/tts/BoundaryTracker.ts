import type { UtteranceChunk } from './types';
import { WORDS_PER_MINUTE_BASE } from '@/lib/constants';

export class BoundaryTracker {
  private currentChunk: UtteranceChunk | null = null;
  private lastCharIndex = -1;

  /**
   * Register the chunk currently being spoken.
   */
  setChunk(chunk: UtteranceChunk): void {
    this.currentChunk = chunk;
    this.lastCharIndex = -1;
  }

  /**
   * Binary search through wordCharOffsets to find which word contains
   * the given charIndex. Returns the global word index.
   */
  resolveWordIndex(charIndex: number): number {
    if (!this.currentChunk || this.currentChunk.wordCharOffsets.length === 0) {
      return 0;
    }

    const offsets = this.currentChunk.wordCharOffsets;
    let low = 0;
    let high = offsets.length - 1;

    // Find the last offset that is <= charIndex
    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (offsets[mid] <= charIndex) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // high is now the index of the last offset <= charIndex
    const localWordIndex = Math.max(0, high);
    return this.currentChunk.startWordIndex + localWordIndex;
  }

  /**
   * Time-based fallback when boundary events are unreliable.
   * Estimates which word is being spoken based on elapsed time and rate.
   */
  estimateWordIndex(elapsedMs: number, rate: number): number {
    if (!this.currentChunk) {
      return 0;
    }

    const wordsPerMs = (rate * WORDS_PER_MINUTE_BASE) / 60000;
    const estimatedWordOffset = Math.floor(elapsedMs * wordsPerMs);
    const chunkWordCount = this.currentChunk.endWordIndex - this.currentChunk.startWordIndex + 1;
    const clampedOffset = Math.min(estimatedWordOffset, chunkWordCount - 1);

    return this.currentChunk.startWordIndex + Math.max(0, clampedOffset);
  }

  /**
   * Validate a charIndex from a boundary event.
   * Returns false if the charIndex goes backwards or seems invalid,
   * indicating broken boundary events.
   */
  validateCharIndex(charIndex: number): boolean {
    if (charIndex < 0) {
      return false;
    }

    if (!this.currentChunk) {
      return false;
    }

    // charIndex going backwards indicates broken events
    if (charIndex < this.lastCharIndex) {
      return false;
    }

    // charIndex beyond the text length is invalid
    if (charIndex >= this.currentChunk.text.length) {
      return false;
    }

    this.lastCharIndex = charIndex;
    return true;
  }
}
