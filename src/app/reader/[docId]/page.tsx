'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { getDocument } from '@/db/documents';
import { getReadingState } from '@/db/readingState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ReaderView } from '@/components/reader/ReaderView';
import type { DocumentMeta } from '@/types';

export default function ReaderPage() {
  const params = useParams<{ docId: string }>();
  const router = useRouter();
  const docId = params.docId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentMeta | null>(null);

  const openDocument = useAppStore((s) => s.openDocument);
  const closeDocument = useAppStore((s) => s.closeDocument);

  useEffect(() => {
    if (!docId) return;

    let cancelled = false;

    async function load() {
      try {
        const doc = await getDocument(docId);
        if (cancelled) return;

        if (!doc) {
          setError('Document not found.');
          setLoading(false);
          return;
        }

        // Determine starting chapter from saved reading state
        const saved = await getReadingState(docId);
        const chapterIndex = saved?.currentChapterIndex ?? 0;

        await openDocument(docId, chapterIndex);
        if (cancelled) return;

        setDocument(doc);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load document.');
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      closeDocument();
    };
  }, [docId, openDocument, closeDocument]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh gap-4 px-4">
        <p className="text-muted text-sm">{error ?? 'Document not found.'}</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return <ReaderView document={document} />;
}
