'use client';

import { useState, useEffect } from 'react';
import { isSafari } from '@/lib/platformDetector';

export function SafariBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isSafari()) return;

    // Show on each session — sessionStorage clears when tab closes
    const dismissed = sessionStorage.getItem('teresa-safari-banner-dismissed');
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('teresa-safari-banner-dismissed', '1');
    setVisible(false);
  };

  return (
    <div
      role="alert"
      className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-4 py-3"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Safari may delete your library data after 7 days of inactivity.</p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              Add Teresa TTS to your Home Screen for permanent storage.
              Tap the share button{' '}
              <span aria-label="share icon" className="inline-block align-text-bottom">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline" aria-hidden="true">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </span>
              {' '}then &ldquo;Add to Home Screen.&rdquo;
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 inline-flex h-9 items-center justify-center rounded-lg px-4
            text-sm font-medium text-amber-800 dark:text-amber-200
            bg-amber-100 dark:bg-amber-900/50
            hover:bg-amber-200 dark:hover:bg-amber-900
            transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          aria-label="Dismiss Safari storage warning"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
