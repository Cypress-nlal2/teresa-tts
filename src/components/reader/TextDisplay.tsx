'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import type { Word, Chapter } from '@/types';
import { TouchGuard } from './TouchGuard';

interface TextDisplayProps {
  words: Word[];
  chapters: Chapter[];
  currentChapterIndex: number;
  currentWordIndex: number;
  onSeekToWord: (wordIndex: number) => void;
  touchGuardEnabled: boolean;
  onDisableTouchGuard: () => void;
}

interface Paragraph {
  words: Word[];
  chapterTitle?: string;
}

export function TextDisplay({
  words,
  chapters,
  currentChapterIndex,
  currentWordIndex,
  onSeekToWord,
  touchGuardEnabled,
  onDisableTouchGuard,
}: TextDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLElement | null>(null);

  // Group words into paragraphs
  const paragraphs = useMemo(() => {
    if (words.length === 0) return [];

    const result: Paragraph[] = [];
    let currentParagraph: Word[] = [];
    const chapter = chapters[currentChapterIndex];
    const chapterTitle = chapter?.title;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      if (word.paragraphBreakBefore && currentParagraph.length > 0) {
        result.push({
          words: currentParagraph,
          ...(result.length === 0 && chapterTitle ? { chapterTitle } : {}),
        });
        currentParagraph = [];
      }

      currentParagraph.push(word);
    }

    if (currentParagraph.length > 0) {
      result.push({
        words: currentParagraph,
        ...(result.length === 0 && chapterTitle ? { chapterTitle } : {}),
      });
    }

    return result;
  }, [words, chapters, currentChapterIndex]);

  // Direct DOM manipulation for word highlighting (avoid re-renders)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove old highlight
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove(
        'bg-primary/20',
        'ring-1',
        'ring-primary',
        'rounded-sm',
      );
      highlightedRef.current.removeAttribute('data-active');
      highlightedRef.current.removeAttribute('aria-current');
      highlightedRef.current = null;
    }

    // Add new highlight
    const el = container.querySelector(
      `[data-word-index="${currentWordIndex}"]`,
    ) as HTMLElement | null;

    if (el) {
      el.classList.add('bg-primary/20', 'ring-1', 'ring-primary', 'rounded-sm');
      el.setAttribute('data-active', 'true');
      el.setAttribute('aria-current', 'true');
      highlightedRef.current = el;

      // Auto-scroll into view
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentWordIndex]);

  const handleWordClick = useCallback(
    (wordIndex: number) => {
      if (!touchGuardEnabled) {
        onSeekToWord(wordIndex);
      }
    },
    [touchGuardEnabled, onSeekToWord],
  );

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto scroll-touch">
      <TouchGuard enabled={touchGuardEnabled} onDisable={onDisableTouchGuard} />

      <div className="mx-auto max-w-2xl px-5 py-8 leading-[1.7]">
        {paragraphs.map((para, pIdx) => (
          <div key={pIdx}>
            {para.chapterTitle && (
              <div className="mb-6 mt-2">
                <div className="border-t border-border mb-4" />
                <h2 className="text-xl font-bold text-foreground">
                  {para.chapterTitle}
                </h2>
              </div>
            )}
            <p className="mb-4 text-foreground">
              {para.words.map((word) => (
                <span key={word.index} className="inline">
                  <button
                    type="button"
                    data-word-index={word.index}
                    onClick={() => handleWordClick(word.index)}
                    className="word cursor-pointer border-none bg-transparent p-0 font-inherit text-inherit text-base leading-[1.7] transition-colors duration-75 hover:bg-surface-hover rounded-sm"
                  >
                    {word.text}
                  </button>{' '}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
