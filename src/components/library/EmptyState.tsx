'use client';

function BookIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-muted/60"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  );
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <BookIcon />
      <h2 className="mt-6 text-xl font-semibold text-foreground">
        Your library is empty
      </h2>
      <p className="mt-2 max-w-xs text-sm text-muted">
        Upload a PDF, DOCX, TXT, or EPUB file to get started.
        Your documents will appear here.
      </p>
    </div>
  );
}
