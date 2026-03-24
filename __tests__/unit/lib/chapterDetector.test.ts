import { describe, it, expect } from 'vitest';
import { detectChapters } from '@/engine/parser/chapterDetector';

describe('detectChapters', () => {
  it('detects "Chapter X" headings', () => {
    const text = `Chapter 1: Introduction
Some introduction text here.

Chapter 2: Background
Background information here.`;

    const chapters = detectChapters(text);
    expect(chapters.length).toBe(2);
    expect(chapters[0].title).toContain('Chapter 1');
    expect(chapters[0].content).toContain('introduction text');
    expect(chapters[1].title).toContain('Chapter 2');
  });

  it('detects "CHAPTER" (uppercase) headings', () => {
    const text = `CHAPTER ONE
First chapter content.

CHAPTER TWO
Second chapter content.`;

    const chapters = detectChapters(text);
    expect(chapters.length).toBe(2);
  });

  it('detects "Part" and "Section" headings', () => {
    const text = `Part I
First part.

Part II
Second part.`;

    const chapters = detectChapters(text);
    expect(chapters.length).toBe(2);
    expect(chapters[0].title).toContain('Part I');
  });

  it('detects ALL-CAPS title lines', () => {
    const text = `INTRODUCTION
This is the intro.

BACKGROUND
This is the background.

METHODOLOGY
This is the methodology.`;

    const chapters = detectChapters(text);
    expect(chapters.length).toBeGreaterThanOrEqual(3);
  });

  it('detects section breaks (3+ blank lines)', () => {
    const text = `First section content.



Second section content.



Third section content.`;

    const chapters = detectChapters(text);
    expect(chapters.length).toBe(3);
    expect(chapters[0].title).toBe('Section 1');
  });

  it('falls back to single chapter when no structure found', () => {
    const text = 'Just some plain text without any chapter markers or structure.';
    const chapters = detectChapters(text);
    expect(chapters.length).toBe(1);
    expect(chapters[0].title).toBe('Document');
    expect(chapters[0].content).toBe(text);
  });

  it('handles numbered headings', () => {
    const text = `1. First Topic
Content for first.

2. Second Topic
Content for second.

3. Third Topic
Content for third.`;

    const chapters = detectChapters(text);
    expect(chapters.length).toBeGreaterThanOrEqual(3);
  });

  it('ignores short ALL-CAPS lines that are just numbers', () => {
    const text = `123
This is regular text with a number above.

456
More regular text.`;

    const chapters = detectChapters(text);
    // Numbers alone shouldn't be detected as ALL-CAPS titles
    expect(chapters.every((ch) => ch.title !== '123')).toBe(true);
  });
});
