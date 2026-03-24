'use client';

import type { ParsingProgress } from '@/types';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface ParsingOverlayProps {
  progress: ParsingProgress;
}

export function ParsingOverlay({ progress }: ParsingOverlayProps) {
  const hasError = progress.error !== null;
  const percent = Math.round(progress.progress);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center
        bg-background/80 backdrop-blur-sm"
      role="alert"
      aria-live="polite"
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-border
          bg-surface p-6 shadow-xl space-y-4"
      >
        {hasError ? (
          <>
            {/* Error state */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-danger"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Parsing failed
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {progress.fileName}
                </p>
              </div>
            </div>
            <p className="text-sm text-danger bg-danger/5 rounded-lg p-3">
              {progress.error}
            </p>
            <p className="text-xs text-muted">
              Try uploading the file again, or use a different format.
            </p>
          </>
        ) : (
          <>
            {/* Progress state */}
            <div className="flex items-center gap-3">
              <LoadingSpinner size="sm" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Parsing document...
                </p>
                <p className="text-xs text-muted mt-0.5 line-clamp-1">
                  {progress.fileName}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                <span>Processing</span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-border/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${percent}%` }}
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Parsing progress: ${percent}%`}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
