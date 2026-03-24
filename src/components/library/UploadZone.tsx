'use client';

import { useCallback, useRef, useState } from 'react';

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.epub'];
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/epub+zip',
];
const ACCEPT_STRING = ACCEPTED_EXTENSIONS.join(',');

function isValidFile(file: File): boolean {
  // Check by MIME type first
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  // Fallback: check extension (some browsers don't set MIME for epub)
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function UploadCloudIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-muted transition-colors duration-200 group-hover:text-primary"
    >
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      <path d="M16 16l-4-4-4 4" />
    </svg>
  );
}

export function UploadZone({ onFileSelected, disabled = false }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleFile = useCallback(
    (file: File) => {
      if (disabled) return;
      // Safari compatibility: filter folders
      if (file.type === '' && file.size === 0) return;
      if (!isValidFile(file)) return;
      onFileSelected(file);
    },
    [disabled, onFileSelected],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current++;
      setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset so the same file can be selected again
      e.target.value = '';
    },
    [handleFile],
  );

  const handleBrowseClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div
      data-testid="upload-zone"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload a document by dropping a file here or clicking Browse files"
      aria-disabled={disabled}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleBrowseClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBrowseClick();
        }
      }}
      className={`group relative flex min-h-[200px] md:min-h-[160px] w-full flex-col
        items-center justify-center gap-4 rounded-xl border-2 border-dashed p-6
        transition-all duration-200 cursor-pointer
        ${
          disabled
            ? 'border-border bg-surface/50 opacity-50 cursor-not-allowed'
            : isDragOver
              ? 'border-primary bg-primary/5 dark:bg-primary/10 scale-[1.01]'
              : 'border-border hover:border-primary/50 hover:bg-surface-hover'
        }
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        focus-visible:ring-offset-background`}
    >
      <UploadCloudIcon />

      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-foreground">
          {isDragOver ? 'Drop your file here' : 'Drag and drop a file here'}
        </p>
        <p className="text-xs text-muted">or</p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          handleBrowseClick();
        }}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg
          bg-primary px-5 text-sm font-medium text-white
          hover:bg-primary-hover transition-colors
          focus:outline-none focus-visible:ring-2
          focus-visible:ring-primary focus-visible:ring-offset-2
          focus-visible:ring-offset-background
          active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Browse files
      </button>

      <p className="text-xs text-muted">
        Supported formats: PDF, DOCX, TXT, EPUB
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
