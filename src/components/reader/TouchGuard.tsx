'use client';

import { useRef, useCallback } from 'react';

interface TouchGuardProps {
  enabled: boolean;
  onDisable: () => void;
}

export function TouchGuard({ enabled, onDisable }: TouchGuardProps) {
  const lastTapRef = useRef(0);

  const handleTap = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastTapRef.current < 350) {
        onDisable();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    },
    [onDisable],
  );

  if (!enabled) return null;

  return (
    <div
      className="absolute inset-0 z-20"
      onClick={handleTap}
      onTouchEnd={handleTap}
      role="button"
      tabIndex={-1}
      aria-label="Touch guard active. Double tap to unlock."
    >
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 backdrop-blur-sm px-4 py-2 text-xs text-muted border border-border shadow-sm select-none">
        Touch guard is on — double tap to unlock
      </div>
    </div>
  );
}
