'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/store';
import type { DocumentMeta, ParsingProgress, Word } from '@/types';

export function useDocumentParser() {
  const setParsingState = useAppStore((s) => s.setParsingState);
  const addDocument = useAppStore((s) => s.addDocument);

  const parseFile = useCallback(
    async (file: File): Promise<void> => {
      setParsingState({
        isActive: true,
        fileName: file.name,
        progress: 0,
        error: null,
      });

      try {
        // Dynamic import to avoid bundling heavy deps at page load
        const { ParserManager } = await import('@/engine/parser/ParserManager');
        const parser = new ParserManager();

        const parsed = await parser.parseFile(file, (progress: ParsingProgress) => {
          setParsingState(progress);
        });

        // Split words into chapters for storage
        const wordsByChapter: Word[][] = [];
        for (const chapter of parsed.chapters) {
          const chapterWords = parsed.words.filter(
            (w: Word) =>
              w.index >= chapter.startWordIndex &&
              w.index <= chapter.endWordIndex,
          );
          wordsByChapter.push(chapterWords);
        }

        const meta: DocumentMeta = {
          id: parsed.id,
          title: parsed.title,
          fileName: parsed.fileName,
          format: parsed.format,
          totalWords: parsed.totalWords,
          chapters: parsed.chapters,
          addedAt: Date.now(),
          fileSize: parsed.fileSize,
        };

        await addDocument(meta, wordsByChapter);

        setParsingState({
          isActive: false,
          fileName: '',
          progress: 0,
          error: null,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        setParsingState({
          error: message,
          progress: 0,
        });
      }
    },
    [setParsingState, addDocument],
  );

  const isActive = useAppStore((s) => s.parsingState.isActive);

  return { parseFile, isActive };
}
