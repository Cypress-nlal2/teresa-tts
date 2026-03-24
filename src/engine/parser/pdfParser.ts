import { normalizeText } from './textNormalizer';

interface PdfChapter {
  title: string;
  text: string;
}

interface PdfParseResult {
  title: string;
  chapters: PdfChapter[];
}

/** Batch size for page processing — yield between batches to keep UI responsive */
const PAGE_BATCH_SIZE = 10;

/** Fallback chapter size when no headings are detected */
const FALLBACK_CHAPTER_PAGES = 50;

/**
 * Parse a PDF file from an ArrayBuffer.
 *
 * Uses dynamic import for pdfjs-dist (code splitting).
 * Processes pages in batches, yielding between batches to avoid blocking the UI.
 */
export async function parsePdfFile(
  buffer: ArrayBuffer,
  fileName: string,
  onProgress: (percent: number) => void
): Promise<PdfParseResult> {
  const pdfjsLib = await import('pdfjs-dist');

  // Point pdfjs to the worker file in public/workers
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.min.mjs';

  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  // Title: try PDF metadata first, then fall back to filename
  let title = fileName.replace(/\.[^.]+$/, '');
  try {
    const metadata = await pdf.getMetadata();
    const infoTitle = (metadata?.info as Record<string, unknown>)?.['Title'];
    if (typeof infoTitle === 'string' && infoTitle.trim().length > 0) {
      title = infoTitle.trim();
    }
  } catch {
    // metadata extraction is best-effort
  }

  // Collect per-page text and font-size info for chapter detection
  const pageTexts: string[] = [];
  const headingCandidates: { pageIndex: number; text: string; fontSize: number }[] = [];
  let medianFontSize = 12; // will be computed

  const allFontSizes: number[] = [];

  for (let start = 0; start < numPages; start += PAGE_BATCH_SIZE) {
    const end = Math.min(start + PAGE_BATCH_SIZE, numPages);

    for (let p = start; p < end; p++) {
      const page = await pdf.getPage(p + 1); // 1-indexed
      const textContent = await page.getTextContent();

      const lines: string[] = [];

      for (const item of textContent.items) {
        if ('str' in item) {
          lines.push(item.str);

          // Track font sizes for heading detection
          if ('height' in item && typeof item.height === 'number' && item.height > 0) {
            allFontSizes.push(item.height);

            // Record items that might be headings (we'll filter by font size later)
            const trimmed = item.str.trim();
            if (trimmed.length > 0 && trimmed.length < 200) {
              headingCandidates.push({
                pageIndex: p,
                text: trimmed,
                fontSize: item.height,
              });
            }
          }
        }
      }

      pageTexts.push(lines.join(' '));

      // Release the page to free memory
      page.cleanup();
    }

    // Report progress
    const progress = Math.round((end / numPages) * 80); // 80% for extraction
    onProgress(progress);

    // Yield to the main thread between batches
    await yieldToMainThread();
  }

  // Compute median font size
  if (allFontSizes.length > 0) {
    allFontSizes.sort((a, b) => a - b);
    medianFontSize = allFontSizes[Math.floor(allFontSizes.length / 2)];
  }

  onProgress(85);

  // Detect chapters using font-size heuristic
  const chapterBreaks = detectPdfChapters(
    headingCandidates,
    medianFontSize,
    numPages
  );

  onProgress(90);

  // Build chapter content
  const chapters = buildChaptersFromBreaks(chapterBreaks, pageTexts);

  // Normalize chapter text
  const normalizedChapters = chapters.map((ch) => ({
    title: ch.title,
    text: normalizeText(ch.text),
  }));

  onProgress(100);

  return { title, chapters: normalizedChapters };
}

/**
 * Detect chapter boundaries based on font size analysis.
 * Items with font size > 1.3x the median are considered headings.
 */
function detectPdfChapters(
  candidates: { pageIndex: number; text: string; fontSize: number }[],
  medianFontSize: number,
  totalPages: number
): { pageIndex: number; title: string }[] {
  const threshold = medianFontSize * 1.3;

  // Filter for heading-like items
  const headings = candidates.filter(
    (c) =>
      c.fontSize >= threshold &&
      c.text.length >= 2 &&
      c.text.length < 150
  );

  // Deduplicate headings that are on the same page (keep the first)
  const seenPages = new Set<number>();
  const uniqueHeadings = headings.filter((h) => {
    if (seenPages.has(h.pageIndex)) return false;
    seenPages.add(h.pageIndex);
    return true;
  });

  if (uniqueHeadings.length >= 2) {
    return uniqueHeadings.map((h) => ({
      pageIndex: h.pageIndex,
      title: h.text,
    }));
  }

  // Fallback: split every FALLBACK_CHAPTER_PAGES pages
  const fallback: { pageIndex: number; title: string }[] = [];
  for (let p = 0; p < totalPages; p += FALLBACK_CHAPTER_PAGES) {
    fallback.push({
      pageIndex: p,
      title: `Pages ${p + 1}–${Math.min(p + FALLBACK_CHAPTER_PAGES, totalPages)}`,
    });
  }
  return fallback;
}

/**
 * Given chapter break points and per-page text, build chapter objects.
 */
function buildChaptersFromBreaks(
  breaks: { pageIndex: number; title: string }[],
  pageTexts: string[]
): PdfChapter[] {
  if (breaks.length === 0) {
    return [{ title: 'Document', text: pageTexts.join('\n') }];
  }

  const chapters: PdfChapter[] = [];

  for (let i = 0; i < breaks.length; i++) {
    const startPage = breaks[i].pageIndex;
    const endPage =
      i + 1 < breaks.length ? breaks[i + 1].pageIndex : pageTexts.length;

    const text = pageTexts.slice(startPage, endPage).join('\n');
    chapters.push({ title: breaks[i].title, text });
  }

  return chapters.filter((ch) => ch.text.trim().length > 0);
}

/** Yield control back to the event loop */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
