import { normalizeText } from './textNormalizer';
import { detectChapters as detectChaptersFromText } from './chapterDetector';

interface DocxChapter {
  title: string;
  text: string;
}

interface DocxParseResult {
  title: string;
  chapters: DocxChapter[];
}

/**
 * Parse a DOCX file from an ArrayBuffer.
 *
 * Uses mammoth.js (dynamically imported) to:
 * 1. Extract raw text for TTS content
 * 2. Convert to HTML to detect heading-based chapter boundaries
 */
export async function parseDocxFile(
  buffer: ArrayBuffer,
  fileName: string,
  onProgress: (percent: number) => void
): Promise<DocxParseResult> {
  const mammoth = await import('mammoth');

  onProgress(10);

  // Extract raw text for content
  const textResult = await mammoth.extractRawText({ arrayBuffer: buffer });
  const rawText = textResult.value;

  onProgress(40);

  // Convert to HTML to detect headings
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const html = htmlResult.value;

  onProgress(60);

  const title = fileName.replace(/\.[^.]+$/, '');

  // Try to detect chapters from HTML headings
  const headingChapters = detectChaptersFromHtml(html, rawText);

  onProgress(80);

  let chapters: DocxChapter[];

  if (headingChapters.length > 1) {
    chapters = headingChapters.map((ch) => ({
      title: ch.title,
      text: normalizeText(ch.text),
    }));
  } else {
    // Fall back to text-based chapter detection
    const normalized = normalizeText(rawText);
    const detected = detectChaptersFromText(normalized);
    chapters = detected.map((ch) => ({
      title: ch.title,
      text: ch.content,
    }));
  }

  onProgress(100);

  return { title, chapters };
}

/**
 * Detect chapters by parsing heading tags from mammoth-generated HTML.
 *
 * We find <h1>, <h2>, <h3> tags and use them as chapter boundaries.
 * The actual text content comes from the raw text extraction to ensure
 * clean, unformatted text for TTS.
 */
function detectChaptersFromHtml(
  html: string,
  rawText: string
): { title: string; text: string }[] {
  // Extract heading texts and their positions in order
  const headingRegex = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi;
  const headings: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(html)) !== null) {
    // Strip any remaining HTML tags from heading text
    const headingText = match[1].replace(/<[^>]+>/g, '').trim();
    if (headingText.length > 0) {
      headings.push(headingText);
    }
  }

  if (headings.length === 0) {
    return [];
  }

  // Split the raw text at heading boundaries
  // Each heading text should appear in the raw text
  const chapters: { title: string; text: string }[] = [];
  let remainingText = rawText;

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const headingIdx = remainingText.indexOf(heading);

    if (headingIdx === -1) {
      // Heading not found in raw text — skip
      continue;
    }

    // Text before this heading belongs to the previous chapter
    if (headingIdx > 0 && chapters.length === 0) {
      const preText = remainingText.substring(0, headingIdx).trim();
      if (preText.length > 0) {
        chapters.push({ title: 'Introduction', text: preText });
      }
    } else if (headingIdx > 0 && chapters.length > 0) {
      // Append text before heading to previous chapter
      const prevChapter = chapters[chapters.length - 1];
      const extraText = remainingText.substring(0, headingIdx).trim();
      if (extraText.length > 0) {
        prevChapter.text += '\n\n' + extraText;
      }
    }

    // Start new chapter
    remainingText = remainingText.substring(headingIdx + heading.length);
    chapters.push({ title: heading, text: '' });
  }

  // Remaining text goes to the last chapter
  if (chapters.length > 0 && remainingText.trim().length > 0) {
    chapters[chapters.length - 1].text = remainingText.trim();
  }

  // Filter out empty chapters
  return chapters.filter((ch) => ch.text.trim().length > 0);
}
