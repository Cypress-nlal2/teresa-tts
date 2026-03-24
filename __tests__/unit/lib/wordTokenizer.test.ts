import { describe, it, expect } from 'vitest';
import { tokenizeText, countWordsInText } from '@/lib/wordTokenizer';

describe('tokenizeText', () => {
  it('tokenizes simple text into words', () => {
    const words = tokenizeText('Hello world foo', 0, 0);
    expect(words).toHaveLength(3);
    expect(words[0]).toEqual({
      index: 0,
      text: 'Hello',
      chapterIndex: 0,
      paragraphBreakBefore: false,
    });
    expect(words[1].text).toBe('world');
    expect(words[2].text).toBe('foo');
  });

  it('assigns correct global indices with offset', () => {
    const words = tokenizeText('one two three', 2, 100);
    expect(words[0].index).toBe(100);
    expect(words[1].index).toBe(101);
    expect(words[2].index).toBe(102);
    expect(words[0].chapterIndex).toBe(2);
  });

  it('detects paragraph breaks on double newlines', () => {
    const words = tokenizeText('First paragraph.\n\nSecond paragraph.', 0, 0);
    expect(words).toHaveLength(4);
    expect(words[0].paragraphBreakBefore).toBe(false);
    expect(words[1].paragraphBreakBefore).toBe(false);
    expect(words[2].paragraphBreakBefore).toBe(true); // "Second" starts new paragraph
    expect(words[3].paragraphBreakBefore).toBe(false);
  });

  it('handles multiple whitespace between words', () => {
    const words = tokenizeText('hello    world   test', 0, 0);
    expect(words).toHaveLength(3);
    expect(words.map((w) => w.text)).toEqual(['hello', 'world', 'test']);
  });

  it('preserves punctuation attached to words', () => {
    const words = tokenizeText('Hello, world! How are you?', 0, 0);
    expect(words[0].text).toBe('Hello,');
    expect(words[1].text).toBe('world!');
    expect(words[4].text).toBe('you?');
  });

  it('returns empty array for empty text', () => {
    expect(tokenizeText('', 0, 0)).toEqual([]);
    expect(tokenizeText('   ', 0, 0)).toEqual([]);
  });

  it('handles text with only newlines', () => {
    expect(tokenizeText('\n\n\n', 0, 0)).toEqual([]);
  });
});

describe('countWordsInText', () => {
  it('counts words correctly', () => {
    expect(countWordsInText('hello world')).toBe(2);
    expect(countWordsInText('one two three four five')).toBe(5);
  });

  it('handles multiple whitespace', () => {
    expect(countWordsInText('  hello   world  ')).toBe(2);
  });

  it('returns 0 for empty text', () => {
    expect(countWordsInText('')).toBe(0);
    expect(countWordsInText('   ')).toBe(0);
  });
});
