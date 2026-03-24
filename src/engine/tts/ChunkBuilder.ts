import type { Word } from '@/types';
import type { UtteranceChunk } from './types';

const MIN_WORDS_PER_CHUNK = 20;
const MAX_WORDS_PER_CHUNK = 50;
const SENTENCE_ENDINGS = /[.!?]$/;

export class ChunkBuilder {
  private nextChunkId = 0;

  /**
   * Returns true if the word ends a sentence: ends with .!? AND
   * either it's the last word or the next word starts with uppercase.
   */
  private isSentenceBoundary(word: Word, nextWord: Word | undefined): boolean {
    if (!SENTENCE_ENDINGS.test(word.text)) {
      return false;
    }
    if (!nextWord) {
      return true;
    }
    const firstChar = nextWord.text.charAt(0);
    return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
  }

  /**
   * Build a chunk starting from startWordIndex within the words array.
   */
  buildChunk(words: Word[], startWordIndex: number): UtteranceChunk {
    if (startWordIndex >= words.length) {
      // Edge case: build an empty chunk at the end
      return {
        id: this.nextChunkId++,
        text: '',
        startWordIndex,
        endWordIndex: startWordIndex,
        wordCharOffsets: [],
      };
    }

    let endIndex = startWordIndex;
    let sentenceCount = 0;

    for (let i = startWordIndex; i < words.length; i++) {
      const wordCount = i - startWordIndex + 1;
      const word = words[i];
      const nextWord = i + 1 < words.length ? words[i + 1] : undefined;

      const atSentenceBoundary = this.isSentenceBoundary(word, nextWord);

      if (atSentenceBoundary) {
        sentenceCount++;
        endIndex = i;

        // If we've reached a comfortable size (>= MIN words and at least 1 sentence), stop
        if (wordCount >= MIN_WORDS_PER_CHUNK) {
          break;
        }

        // If we've hit 3 sentences, stop regardless
        if (sentenceCount >= 3) {
          break;
        }
      }

      // Force break at max words if no sentence boundary found
      if (wordCount >= MAX_WORDS_PER_CHUNK) {
        endIndex = i;
        break;
      }

      // If we haven't committed to an end yet, keep extending
      endIndex = i;
    }

    // Build the text and char offsets
    const wordCharOffsets: number[] = [];
    let text = '';

    for (let i = startWordIndex; i <= endIndex; i++) {
      if (i > startWordIndex) {
        text += ' ';
      }
      wordCharOffsets.push(text.length);
      text += words[i].text;
    }

    return {
      id: this.nextChunkId++,
      text,
      startWordIndex,
      endWordIndex: endIndex,
      wordCharOffsets,
    };
  }

  /**
   * Build the next chunk after the current one. Returns null if no more words.
   */
  buildNextChunk(words: Word[], currentChunk: UtteranceChunk): UtteranceChunk | null {
    const nextStart = currentChunk.endWordIndex + 1;
    if (nextStart >= words.length) {
      return null;
    }
    return this.buildChunk(words, nextStart);
  }
}
