'use client';

import { useEffect, useRef } from 'react';
import type { Chapter } from '@/types';

interface ChapterNavProps {
  chapters: Chapter[];
  currentChapterIndex: number;
  onChapterSelect: (index: number) => void;
  open: boolean;
  onClose: () => void;
}

export function ChapterNav({
  chapters,
  currentChapterIndex,
  onChapterSelect,
  open,
  onClose,
}: ChapterNavProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll active chapter into view when opening
  useEffect(() => {
    if (open && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-surface border-r border-border shadow-xl flex flex-col animate-slide-in-left">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Chapters</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label="Close chapters"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto scroll-touch p-2">
          {chapters.map((chapter, index) => (
            <button
              key={index}
              ref={index === currentChapterIndex ? activeRef : undefined}
              type="button"
              onClick={() => {
                onChapterSelect(index);
                onClose();
              }}
              aria-label={`Chapter ${index + 1}: ${chapter.title}`}
              aria-current={index === currentChapterIndex ? 'true' : undefined}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors mb-0.5
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
                ${
                  index === currentChapterIndex
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-surface-hover'
                }`}
            >
              <span className="text-muted text-xs mr-2">
                {index + 1}.
              </span>
              {chapter.title}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
