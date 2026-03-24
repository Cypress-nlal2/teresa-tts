'use client';

import { useCallback, useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      // Focus the cancel button by default for safety
      confirmRef.current?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      // Close when clicking the backdrop (the dialog element itself, not its contents)
      if (e.target === dialogRef.current) {
        onCancel();
      }
    },
    [onCancel],
  );

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-danger hover:bg-danger/90 text-white'
      : 'bg-primary hover:bg-primary-hover text-white';

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-auto max-w-sm w-[calc(100%-2rem)]
        rounded-xl bg-surface p-0 text-foreground shadow-xl
        border border-border backdrop:bg-black/50 backdrop:backdrop-blur-sm
        open:animate-in open:fade-in open:zoom-in-95"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div className="p-6">
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold mb-2"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-message"
          className="text-sm text-muted mb-6"
        >
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-lg
              px-4 text-sm font-medium text-foreground
              bg-surface-hover hover:bg-border transition-colors
              focus:outline-none focus-visible:ring-2
              focus-visible:ring-primary"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`inline-flex h-11 items-center justify-center rounded-lg
              px-4 text-sm font-medium transition-colors
              focus:outline-none focus-visible:ring-2
              focus-visible:ring-primary ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
