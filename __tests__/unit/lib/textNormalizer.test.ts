import { describe, it, expect } from 'vitest';
import { normalizeText } from '@/engine/parser/textNormalizer';

describe('normalizeText', () => {
  it('removes bare page numbers', () => {
    const input = 'Some text.\n42\nMore text.';
    const result = normalizeText(input);
    expect(result).not.toContain('\n42\n');
    expect(result).toContain('Some text.');
    expect(result).toContain('More text.');
  });

  it('removes "Page X" lines', () => {
    const input = 'Content here.\nPage 15\nMore content.';
    expect(normalizeText(input)).not.toMatch(/Page 15/i);
  });

  it('removes "- X -" page number patterns', () => {
    const input = 'Content.\n- 42 -\nMore content.';
    expect(normalizeText(input)).not.toContain('- 42 -');
  });

  it('fixes hyphenation at line breaks', () => {
    const input = 'This is a hyph-\nenated word.';
    const result = normalizeText(input);
    expect(result).toContain('hyphenated');
  });

  it('does not join hyphenation when next line starts with uppercase', () => {
    const input = 'Some text-\nAnother sentence.';
    const result = normalizeText(input);
    expect(result).toContain('text-');
  });

  it('collapses excessive blank lines', () => {
    const input = 'First.\n\n\n\n\n\nSecond.';
    const result = normalizeText(input);
    // Should have at most 3 newlines (2 blank lines)
    expect(result.match(/\n/g)?.length ?? 0).toBeLessThanOrEqual(3);
  });

  it('removes control characters', () => {
    const input = 'Hello\x00\x01\x02 world';
    expect(normalizeText(input)).toBe('Hello world');
  });

  it('normalizes Unicode whitespace', () => {
    const input = 'Hello\u00A0world\u2003test';
    const result = normalizeText(input);
    expect(result).toBe('Hello world test');
  });

  it('trims lines but preserves paragraph structure', () => {
    const input = '  Hello world.  \n\n  Next paragraph.  ';
    const result = normalizeText(input);
    expect(result).toContain('Hello world.');
    expect(result).toContain('Next paragraph.');
  });

  it('handles empty input', () => {
    expect(normalizeText('')).toBe('');
  });
});
