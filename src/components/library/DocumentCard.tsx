'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DocumentMeta, ReadingState } from '@/types';
import { getReadingState } from '@/db/readingState';

interface DocumentCardProps {
  document: DocumentMeta;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const FORMAT_BADGE_STYLES: Record<DocumentMeta['format'], string> = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  txt: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
  epub: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function DocumentCard({ document, onOpen, onDelete }: DocumentCardProps) {
  const [readingState, setReadingState] = useState<ReadingState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReadingState(document.id).then((state) => {
      if (!cancelled && state) {
        setReadingState(state);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [document.id]);

  const handleOpen = useCallback(() => {
    onOpen(document.id);
  }, [document.id, onOpen]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(document.id);
    },
    [document.id, onDelete],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(document.id);
      }
    },
    [document.id, onOpen],
  );

  const progressPercent =
    readingState && document.totalWords > 0
      ? Math.round((readingState.currentWordIndex / document.totalWords) * 100)
      : 0;

  const isFinished = readingState?.isFinished ?? false;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col rounded-xl border border-border
        bg-surface p-4 shadow-sm transition-all duration-200
        hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30
        cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
        focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Delete button */}
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`Delete ${document.title}`}
        className="absolute top-2 right-2 z-10 inline-flex h-8 w-8 items-center
          justify-center rounded-lg text-muted
          opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
          hover:bg-danger/10 hover:text-danger
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
          focus-visible:opacity-100"
      >
        <TrashIcon />
      </button>

      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground line-clamp-2 pr-8 mb-2">
        {document.title}
      </h3>

      {/* Format badge + file info */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5
            text-[10px] font-semibold uppercase tracking-wide
            ${FORMAT_BADGE_STYLES[document.format]}`}
        >
          {document.format}
        </span>
        {isFinished && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5
              text-[10px] font-semibold uppercase tracking-wide
              bg-success/10 text-success"
          >
            Finished
          </span>
        )}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted mb-3">
        <span>{formatFileSize(document.fileSize)}</span>
        <span aria-hidden="true" className="text-border">|</span>
        <span>
          {document.chapters.length} {document.chapters.length === 1 ? 'chapter' : 'chapters'}
        </span>
        <span aria-hidden="true" className="text-border">|</span>
        <span>{formatDate(document.addedAt)}</span>
      </div>

      {/* Progress bar */}
      {readingState && !isFinished && (
        <div className="mt-auto">
          <div className="flex items-center justify-between text-[10px] text-muted mb-1">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Reading progress: ${progressPercent}%`}
            />
          </div>
        </div>
      )}

      {isFinished && (
        <div className="mt-auto">
          <div className="h-1.5 w-full rounded-full bg-success/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-success w-full"
              role="progressbar"
              aria-valuenow={100}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Reading complete"
            />
          </div>
        </div>
      )}
    </article>
  );
}
