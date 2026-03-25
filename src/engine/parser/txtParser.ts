import { v4 as uuid } from 'uuid';
import type { ParsedDocument, Chapter, Word } from '@/types';
import { tokenizeText } from '@/lib/wordTokenizer';
import { normalizeText } from './textNormalizer';
import { detectChapters } from './chapterDetector';

/**
 * Parse a plain-text file into a ParsedDocument.
 */
export async function parseTxtFile(file: File): Promise<ParsedDocument> {
  const rawText = await file.text();
  const normalized = normalizeText(rawText);
  const detected = detectChapters(normalized);

  const chapters: Chapter[] = [];
  const allWords: Word[] = [];
  let globalIndex = 0;

  for (let i = 0; i < detected.length; i++) {
    const { title, content } = detected[i];

    const words = tokenizeText(content, i, globalIndex);
    const startWordIndex = globalIndex;
    const endWordIndex = globalIndex + words.length - 1;

    if (words.length > 0) {
      chapters.push({ title, startWordIndex, endWordIndex });
      allWords.push(...words);
      globalIndex += words.length;
    }
  }

  // Derive title from filename (strip extension)
  const title = file.name.replace(/\.[^.]+$/, '');

  return {
    id: uuid(),
    title,
    fileName: file.name,
    format: 'txt',
    chapters,
    words: allWords,
    totalWords: allWords.length,
    fileSize: file.size,
  };
}
