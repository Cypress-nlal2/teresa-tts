'use client';

import { useCallback } from 'react';

interface SpeedControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  minSpeed: number;
  maxSpeed: number;
  onClose: () => void;
}

const PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export function SpeedControl({
  speed,
  onSpeedChange,
  minSpeed,
  maxSpeed,
  onClose,
}: SpeedControlProps) {
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSpeedChange(parseFloat(e.target.value));
    },
    [onSpeedChange],
  );

  const filteredPresets = PRESETS.filter((p) => p >= minSpeed && p <= maxSpeed);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl bg-surface border border-border shadow-lg p-4 z-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">
          Speed: {speed.toFixed(1)}x
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-11 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          aria-label="Close speed control"
        >
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <input
        type="range"
        min={minSpeed}
        max={maxSpeed}
        step={0.1}
        value={speed}
        onChange={handleSliderChange}
        className="w-full h-2 rounded-full appearance-none bg-border accent-primary cursor-pointer"
        aria-label="Playback speed"
      />

      <div className="flex gap-1.5 mt-3 flex-wrap">
        {filteredPresets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onSpeedChange(preset)}
            aria-label={`Set speed to ${preset}x`}
            className={`h-11 min-w-[44px] px-3 rounded-lg text-xs font-medium transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
              ${
                Math.abs(speed - preset) < 0.05
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-foreground hover:bg-border'
              }`}
          >
            {preset}x
          </button>
        ))}
      </div>
    </div>
  );
}
