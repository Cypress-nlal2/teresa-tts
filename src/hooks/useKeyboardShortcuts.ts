'use client';

import { useEffect } from 'react';

interface KeyboardActions {
  togglePlayPause: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  speedUp: () => void;
  speedDown: () => void;
  nextChapter: () => void;
  prevChapter: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardActions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when focused on interactive elements
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          actions.togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          actions.skipForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          actions.skipBackward();
          break;
        case 'ArrowUp':
        case '+':
        case ']':
          e.preventDefault();
          actions.speedUp();
          break;
        case 'ArrowDown':
        case '-':
        case '[':
          e.preventDefault();
          actions.speedDown();
          break;
        case 'n':
        case '.':
          actions.nextChapter();
          break;
        case 'p':
        case ',':
          actions.prevChapter();
          break;
        case 'Escape':
          window.history.back();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
