'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { useDocumentParser } from '@/hooks/useDocumentParser';
import { getReadingState } from '@/db/readingState';
import { UploadZone } from '@/components/library/UploadZone';
import { DocumentCard } from '@/components/library/DocumentCard';
import { ParsingOverlay } from '@/components/library/ParsingOverlay';
import { EmptyState } from '@/components/library/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { checkStorageAvailability } from '@/lib/storageCheck';
import type { DocumentMeta } from '@/types';

export function LibraryView() {
  const router = useRouter();
  const documents = useAppStore((s) => s.documents);
  const parsingState = useAppStore((s) => s.parsingState);
  const loadDocumentList = useAppStore((s) => s.loadDocumentList);
  const removeDocument = useAppStore((s) => s.removeDocument);
  const setParsingState = useAppStore((s) => s.setParsingState);
  const { parseFile, isActive: isParsing } = useDocumentParser();

  const [sortedDocuments, setSortedDocuments] = useState<DocumentMeta[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DocumentMeta | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  // Check storage on mount
  useEffect(() => {
    checkStorageAvailability().then((result) => {
      if (!result.available) {
        setStorageUnavailable(true);
      }
    });
  }, []);

  // Load documents on mount
  useEffect(() => {
    loadDocumentList();
  }, [loadDocumentList]);

  // Sort documents: most recently read first, then by date added
  useEffect(() => {
    let cancelled = false;

    async function sortDocs() {
      const readTimes = new Map<string, number>();

      await Promise.all(
        documents.map(async (doc) => {
          const state = await getReadingState(doc.id);
          if (state) {
            readTimes.set(doc.id, state.lastReadAt);
          }
        }),
      );

      if (cancelled) return;

      const sorted = [...documents].sort((a, b) => {
        const aRead = readTimes.get(a.id) ?? 0;
        const bRead = readTimes.get(b.id) ?? 0;

        // Documents with reading history come first, sorted by last read
        if (aRead > 0 && bRead > 0) return bRead - aRead;
        if (aRead > 0) return -1;
        if (bRead > 0) return 1;

        // Then by date added (newest first)
        return b.addedAt - a.addedAt;
      });

      setSortedDocuments(sorted);
    }

    sortDocs();
    return () => {
      cancelled = true;
    };
  }, [documents]);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  const handleFileSelected = useCallback(
    (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        setParsingState({
          isActive: false,
          fileName: file.name,
          progress: 0,
          error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum supported size is 100 MB.`,
        });
        return;
      }
      parseFile(file);
    },
    [parseFile, setParsingState],
  );

  const handleOpenDocument = useCallback(
    (id: string) => {
      router.push(`/reader/${id}`);
    },
    [router],
  );

  const handleDeleteRequest = useCallback(
    (id: string) => {
      const doc = documents.find((d) => d.id === id);
      if (doc) {
        setDeleteTarget(doc);
      }
    },
    [documents],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (deleteTarget) {
      await removeDocument(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, removeDocument]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleDismissError = useCallback(() => {
    setParsingState({
      isActive: false,
      fileName: '',
      progress: 0,
      error: null,
    });
  }, [setParsingState]);

  const showOverlay = parsingState.isActive || parsingState.error !== null;

  return (
    <div className="space-y-6">
      {/* Storage unavailable warning */}
      {storageUnavailable && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-center"
        >
          <p className="text-sm font-medium text-danger">
            Storage is not available
          </p>
          <p className="text-xs text-muted mt-1">
            You may be in private/incognito browsing mode. Documents cannot be
            saved. Please use a regular browser window.
          </p>
        </div>
      )}

      {/* Upload zone */}
      {!storageUnavailable && (
        <UploadZone onFileSelected={handleFileSelected} disabled={isParsing} />
      )}

      {/* Parsing overlay */}
      {showOverlay && (
        <div
          onClick={parsingState.error !== null ? handleDismissError : undefined}
        >
          <ParsingOverlay progress={parsingState} />
        </div>
      )}

      {/* Document grid or empty state */}
      {sortedDocuments.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="grid grid-cols-1 gap-4
            sm:grid-cols-2
            lg:grid-cols-3"
        >
          {sortedDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onOpen={handleOpenDocument}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete document"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.title}"? This will also remove your reading progress.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
