import { v4 as uuid } from 'uuid';
import type { ParsedDocument, Chapter, Word, ParsingProgress } from '@/types';
import { SUPPORTED_MIME_TYPES } from '@/lib/constants';
import { tokenizeText } from '@/lib/wordTokenizer';
import { parseTxtFile } from './txtParser';
import { parsePdfFile } from './pdfParser';
import { parseDocxFile } from './docxParser';

type SupportedFormat = 'pdf' | 'docx' | 'txt' | 'epub';

/**
 * Orchestrates document parsing.
 *
 * - Detects file format from MIME type or extension
 * - Routes to the appropriate parser
 * - Tokenizes chapter text into Word arrays
 * - Builds a complete ParsedDocument with correct indices
 */
export class ParserManager {
  /**
   * Parse a file into a ParsedDocument.
   *
   * @param file - The File object to parse
   * @param onProgress - Callback for progress updates
   * @returns A fully populated ParsedDocument
   */
  async parseFile(
    file: File,
    onProgress: (progress: ParsingProgress) => void
  ): Promise<ParsedDocument> {
    const format = this.detectFormat(file);

    if (!format) {
      throw new Error(
        `Unsupported file format: ${file.name}. Supported formats: PDF, DOCX, TXT, EPUB.`
      );
    }

    const emitProgress = (percent: number, error: string | null = null) => {
      onProgress({
        isActive: error === null && percent < 100,
        fileName: file.name,
        progress: percent,
        error,
      });
    };

    try {
      emitProgress(0);

      if (format === 'txt') {
        return await this.parseTxt(file, emitProgress);
      }

      if (format === 'pdf') {
        return await this.parsePdf(file, emitProgress);
      }

      if (format === 'docx') {
        return await this.parseDocx(file, emitProgress);
      }

      if (format === 'epub') {
        throw new Error('EPUB parsing is not yet implemented.');
      }

      throw new Error(`Unexpected format: ${format}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown parsing error';
      emitProgress(0, message);
      throw err;
    }
  }

  /** Detect the document format from MIME type or file extension. */
  private detectFormat(file: File): SupportedFormat | null {
    // Try MIME type first
    if (file.type && file.type in SUPPORTED_MIME_TYPES) {
      return SUPPORTED_MIME_TYPES[file.type] as SupportedFormat;
    }

    // Fall back to extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    if (ext === 'txt') return 'txt';
    if (ext === 'epub') return 'epub';

    return null;
  }

  /** Parse a TXT file. */
  private async parseTxt(
    file: File,
    emitProgress: (percent: number) => void
  ): Promise<ParsedDocument> {
    emitProgress(10);
    const doc = await parseTxtFile(file);
    emitProgress(100);
    return doc;
  }

  /** Parse a PDF file. */
  private async parsePdf(
    file: File,
    emitProgress: (percent: number) => void
  ): Promise<ParsedDocument> {
    const buffer = await file.arrayBuffer();

    const result = await parsePdfFile(buffer, file.name, (percent) => {
      // Scale parser progress to 0–80% (remaining 20% for tokenization)
      emitProgress(Math.round(percent * 0.8));
    });

    return this.buildParsedDocument(
      result.title,
      result.chapters,
      file,
      'pdf',
      emitProgress
    );
  }

  /** Parse a DOCX file. */
  private async parseDocx(
    file: File,
    emitProgress: (percent: number) => void
  ): Promise<ParsedDocument> {
    const buffer = await file.arrayBuffer();

    const result = await parseDocxFile(buffer, file.name, (percent) => {
      emitProgress(Math.round(percent * 0.8));
    });

    return this.buildParsedDocument(
      result.title,
      result.chapters,
      file,
      'docx',
      emitProgress
    );
  }

  /**
   * Build a ParsedDocument from parser output.
   * Tokenizes chapter text and assembles the final structure.
   */
  private async buildParsedDocument(
    title: string,
    rawChapters: { title: string; text: string }[],
    file: File,
    format: SupportedFormat,
    emitProgress: (percent: number) => void
  ): Promise<ParsedDocument> {
    const chapters: Chapter[] = [];
    const allWords: Word[] = [];
    let globalIndex = 0;

    for (let i = 0; i < rawChapters.length; i++) {
      const { title: chTitle, text } = rawChapters[i];

      const words = tokenizeText(text, i, globalIndex);
      const startWordIndex = globalIndex;
      const endWordIndex = globalIndex + words.length - 1;

      if (words.length > 0) {
        chapters.push({ title: chTitle, startWordIndex, endWordIndex });
        allWords.push(...words);
        globalIndex += words.length;
      }

      // Yield between chapters for large documents
      if (i % 5 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    emitProgress(95);

    const parsedDoc: ParsedDocument = {
      id: uuid(),
      title,
      fileName: file.name,
      format,
      chapters,
      words: allWords,
      totalWords: allWords.length,
      fileSize: file.size,
    };

    emitProgress(100);
    return parsedDoc;
  }
}
