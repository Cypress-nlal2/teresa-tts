import { describe, it, expect, beforeEach } from 'vitest';
import { BoundaryTracker } from '@/engine/tts/BoundaryTracker';
import type { UtteranceChunk } from '@/engine/tts/types';

function makeChunk(overrides: Partial<UtteranceChunk> = {}): UtteranceChunk {
  // Default: "Hello beautiful world" with offsets [0, 6, 16]
  return {
    id: 1,
    text: 'Hello beautiful world',
    startWordIndex: 10,
    endWordIndex: 12,
    wordCharOffsets: [0, 6, 16],
    ...overrides,
  };
}

describe('BoundaryTracker', () => {
  let tracker: BoundaryTracker;

  beforeEach(() => {
    tracker = new BoundaryTracker();
  });

  describe('resolveWordIndex', () => {
    it('maps charIndex to correct global word index', () => {
      tracker.setChunk(makeChunk());

      // charIndex 0 → "Hello" → global index 10
      expect(tracker.resolveWordIndex(0)).toBe(10);
      // charIndex 3 → still in "Hello" → global index 10
      expect(tracker.resolveWordIndex(3)).toBe(10);
      // charIndex 6 → "beautiful" → global index 11
      expect(tracker.resolveWordIndex(6)).toBe(11);
      // charIndex 10 → still in "beautiful" → global index 11
      expect(tracker.resolveWordIndex(10)).toBe(11);
      // charIndex 16 → "world" → global index 12
      expect(tracker.resolveWordIndex(16)).toBe(12);
    });

    it('returns startWordIndex when no chunk is set', () => {
      expect(tracker.resolveWordIndex(5)).toBe(0);
    });

    it('handles charIndex at exact word boundaries', () => {
      tracker.setChunk(makeChunk());
      expect(tracker.resolveWordIndex(0)).toBe(10);  // exact start of first word
      expect(tracker.resolveWordIndex(6)).toBe(11);  // exact start of second word
      expect(tracker.resolveWordIndex(16)).toBe(12); // exact start of third word
    });

    it('handles charIndex past last word offset', () => {
      tracker.setChunk(makeChunk());
      // charIndex 20 → past "world" start, still resolves to last word
      expect(tracker.resolveWordIndex(20)).toBe(12);
    });
  });

  describe('estimateWordIndex', () => {
    it('estimates word position based on time and rate', () => {
      tracker.setChunk(makeChunk());

      // At rate 1.0, ~150 wpm = 2.5 words/sec
      // After 400ms at 1x: ~1 word
      const idx = tracker.estimateWordIndex(400, 1.0);
      expect(idx).toBeGreaterThanOrEqual(10);
      expect(idx).toBeLessThanOrEqual(12);
    });

    it('clamps to chunk boundaries', () => {
      tracker.setChunk(makeChunk());

      // Very large elapsed time should not exceed endWordIndex
      expect(tracker.estimateWordIndex(100000, 1.0)).toBe(12);
    });

    it('returns 0 when no chunk is set', () => {
      expect(tracker.estimateWordIndex(1000, 1.0)).toBe(0);
    });

    it('scales with rate', () => {
      tracker.setChunk(
        makeChunk({
          startWordIndex: 0,
          endWordIndex: 99,
          wordCharOffsets: Array.from({ length: 100 }, (_, i) => i * 5),
          text: Array.from({ length: 100 }, () => 'word').join(' '),
        })
      );

      const idxAtRate1 = tracker.estimateWordIndex(1000, 1.0);
      const idxAtRate2 = tracker.estimateWordIndex(1000, 2.0);

      expect(idxAtRate2).toBeGreaterThan(idxAtRate1);
    });
  });

  describe('validateCharIndex', () => {
    it('accepts valid forward-moving charIndex', () => {
      tracker.setChunk(makeChunk());
      expect(tracker.validateCharIndex(0)).toBe(true);
      expect(tracker.validateCharIndex(6)).toBe(true);
      expect(tracker.validateCharIndex(16)).toBe(true);
    });

    it('rejects negative charIndex', () => {
      tracker.setChunk(makeChunk());
      expect(tracker.validateCharIndex(-1)).toBe(false);
    });

    it('rejects backwards charIndex', () => {
      tracker.setChunk(makeChunk());
      tracker.validateCharIndex(10);
      expect(tracker.validateCharIndex(5)).toBe(false);
    });

    it('rejects charIndex beyond text length', () => {
      tracker.setChunk(makeChunk());
      expect(tracker.validateCharIndex(100)).toBe(false);
    });

    it('returns false when no chunk is set', () => {
      expect(tracker.validateCharIndex(0)).toBe(false);
    });

    it('resets lastCharIndex when new chunk is set', () => {
      tracker.setChunk(makeChunk());
      tracker.validateCharIndex(15);

      // Set new chunk — should reset tracking
      tracker.setChunk(makeChunk());
      expect(tracker.validateCharIndex(0)).toBe(true); // would fail if not reset
    });
  });
});
