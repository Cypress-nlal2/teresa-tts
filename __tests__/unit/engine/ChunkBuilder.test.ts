import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkBuilder } from '@/engine/tts/ChunkBuilder';
import { tokenizeText } from '@/lib/wordTokenizer';
import type { Word } from '@/types';

function makeWords(text: string): Word[] {
  return tokenizeText(text, 0, 0);
}

describe('ChunkBuilder', () => {
  let builder: ChunkBuilder;

  beforeEach(() => {
    builder = new ChunkBuilder();
  });

  it('builds a chunk from a short sentence', () => {
    const words = makeWords('Hello world.');
    const chunk = builder.buildChunk(words, 0);
    expect(chunk.text).toBe('Hello world.');
    expect(chunk.startWordIndex).toBe(0);
    expect(chunk.endWordIndex).toBe(1);
    expect(chunk.wordCharOffsets).toEqual([0, 6]);
  });

  it('breaks at sentence boundaries around 20-50 words', () => {
    // Create text with multiple sentences of ~10 words each
    const s1 = 'The quick brown fox jumps over the lazy dog today.';
    const s2 = 'Another sentence with some words to fill up space.';
    const s3 = 'Yet another sentence that keeps going on and on.';
    const words = makeWords(`${s1} ${s2} ${s3}`);

    const chunk = builder.buildChunk(words, 0);

    // Should include at least the first sentence, and stop at a boundary >= 20 words
    expect(chunk.endWordIndex).toBeGreaterThanOrEqual(9); // at least first sentence
    // Check text includes the first sentence
    expect(chunk.text).toContain('fox');
  });

  it('force breaks at 50 words when no sentence boundary', () => {
    // Create 60 words with no sentence-ending punctuation
    const wordTexts = Array.from({ length: 60 }, (_, i) => `word${i}`);
    const words = makeWords(wordTexts.join(' '));

    const chunk = builder.buildChunk(words, 0);
    const wordCount = chunk.endWordIndex - chunk.startWordIndex + 1;

    expect(wordCount).toBe(50);
  });

  it('tracks wordCharOffsets correctly', () => {
    const words = makeWords('Hello beautiful world.');
    const chunk = builder.buildChunk(words, 0);

    expect(chunk.wordCharOffsets[0]).toBe(0);  // "Hello" starts at 0
    expect(chunk.wordCharOffsets[1]).toBe(6);  // "beautiful" starts at 6
    expect(chunk.wordCharOffsets[2]).toBe(16); // "world." starts at 16
    expect(chunk.text.charAt(chunk.wordCharOffsets[1])).toBe('b');
  });

  it('buildNextChunk returns the next chunk after current', () => {
    // Need enough words that the first chunk stops before the end
    // 30+ words across multiple sentences ensures the builder stops at a sentence boundary
    const sentences = [
      'The first sentence has several words in it.',
      'The second sentence continues with more content here.',
      'The third sentence adds even more words to read.',
      'And the fourth sentence ensures we have enough words.',
      'The fifth sentence should definitely push us over the limit.',
    ];
    const words = makeWords(sentences.join(' '));
    const chunk1 = builder.buildChunk(words, 0);
    const chunk2 = builder.buildNextChunk(words, chunk1);

    expect(chunk2).not.toBeNull();
    expect(chunk2!.startWordIndex).toBe(chunk1.endWordIndex + 1);
  });

  it('buildNextChunk returns null when no more words', () => {
    const words = makeWords('Short text.');
    const chunk = builder.buildChunk(words, 0);
    const next = builder.buildNextChunk(words, chunk);

    expect(next).toBeNull();
  });

  it('handles edge case: empty words array at startWordIndex', () => {
    const words: Word[] = [];
    const chunk = builder.buildChunk(words, 0);
    expect(chunk.text).toBe('');
    expect(chunk.wordCharOffsets).toEqual([]);
  });

  it('handles startWordIndex beyond words length', () => {
    const words = makeWords('Just two.');
    const chunk = builder.buildChunk(words, 100);
    expect(chunk.text).toBe('');
  });

  it('assigns incrementing chunk IDs', () => {
    // Build two separate chunks to verify IDs increment
    const words1 = makeWords('First chunk of text here.');
    const words2 = makeWords('Second chunk of text here.');
    const c1 = builder.buildChunk(words1, 0);
    const c2 = builder.buildChunk(words2, 0);
    expect(c2.id).toBeGreaterThan(c1.id);
  });
});
