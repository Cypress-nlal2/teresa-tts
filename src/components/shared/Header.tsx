'use client';

import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

interface HeaderProps {
  showBack?: boolean;
}

function BackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function Header({ showBack = false }: HeaderProps) {
  const router = useRouter();

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-sm">
      <nav className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg
                text-muted hover:text-foreground hover:bg-surface-hover
                transition-colors focus:outline-none focus-visible:ring-2
                focus-visible:ring-primary"
            >
              <BackIcon />
            </button>
          )}
          <span className="text-lg font-semibold tracking-tight select-none">
            Teresa TTS{' '}
            <span className="text-accent" aria-hidden="true">
              &#9829;
            </span>
          </span>
        </div>
        <ThemeToggle />
      </nav>
    </header>
  );
}
