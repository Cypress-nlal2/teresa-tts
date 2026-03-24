/**
 * Detect chapter boundaries in plain text.
 *
 * Strategies (tried in order):
 * 1. Explicit chapter/part/section headings (e.g. "Chapter 1", "PART II", "Section 3")
 * 2. Numbered headings ("1.", "1.1", "2.")
 * 3. Short ALL-CAPS lines (<80 chars) that look like titles
 * 4. Major section breaks (3+ blank lines)
 * 5. Fallback: single chapter titled "Document"
 */

interface RawChapter {
  title: string;
  content: string;
}

/** Pattern for explicit chapter/part/section headings */
const CHAPTER_HEADING_RE =
  /^(?:chapter|part|section|prologue|epilogue|introduction|conclusion|appendix)\b[\s.:—\-]*(?:\d+|[IVXLCDM]+)?[\s.:—\-]*(.*)?$/i;

/** Pattern for numbered headings like "1.", "1.1", "2." at start of line */
const NUMBERED_HEADING_RE = /^(\d+\.(?:\d+\.?)*)\s+(.+)$/;

/**
 * Detect chapters in a plain-text document.
 */
export function detectChapters(text: string): RawChapter[] {
  // Try explicit headings first
  const explicit = detectByHeadingPattern(text, CHAPTER_HEADING_RE);
  if (explicit.length > 1) return explicit;

  // Try numbered headings
  const numbered = detectByNumberedHeadings(text);
  if (numbered.length > 1) return numbered;

  // Try ALL-CAPS lines
  const caps = detectByAllCapsLines(text);
  if (caps.length > 1) return caps;

  // Try section breaks (3+ blank lines)
  const sections = detectBySectionBreaks(text);
  if (sections.length > 1) return sections;

  // Fallback: single chapter
  return [{ title: 'Document', content: text }];
}

function detectByHeadingPattern(
  text: string,
  pattern: RegExp
): RawChapter[] {
  const lines = text.split('\n');
  const chapters: RawChapter[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.trim().match(pattern);
    if (match) {
      // Save previous chapter
      if (currentLines.length > 0 || chapters.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content.length > 0 || chapters.length > 0) {
          chapters.push({
            title: currentTitle || 'Untitled',
            content,
          });
        }
      }
      // Start new chapter — build title from the matched line
      currentTitle = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Push last chapter
  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content.length > 0) {
      chapters.push({
        title: currentTitle || 'Untitled',
        content,
      });
    }
  }

  return chapters;
}

function detectByNumberedHeadings(text: string): RawChapter[] {
  const lines = text.split('\n');
  const chapters: RawChapter[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(NUMBERED_HEADING_RE);

    // Only consider it a heading if the line before is blank (or it's the first line)
    // and the line is reasonably short
    if (match && trimmed.length < 100) {
      if (currentLines.length > 0 || chapters.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content.length > 0 || chapters.length > 0) {
          chapters.push({
            title: currentTitle || 'Untitled',
            content,
          });
        }
      }
      currentTitle = trimmed;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content.length > 0) {
      chapters.push({
        title: currentTitle || 'Untitled',
        content,
      });
    }
  }

  return chapters;
}

function detectByAllCapsLines(text: string): RawChapter[] {
  const lines = text.split('\n');
  const chapters: RawChapter[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (isAllCapsTitle(trimmed)) {
      if (currentLines.length > 0 || chapters.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content.length > 0 || chapters.length > 0) {
          chapters.push({
            title: currentTitle || 'Untitled',
            content,
          });
        }
      }
      currentTitle = trimmed;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content.length > 0) {
      chapters.push({
        title: currentTitle || 'Untitled',
        content,
      });
    }
  }

  return chapters;
}

/**
 * Check if a line qualifies as an ALL-CAPS title.
 * Must be: non-empty, <80 chars, >2 word characters, ALL uppercase letters.
 */
function isAllCapsTitle(line: string): boolean {
  if (line.length === 0 || line.length > 80) return false;

  // Must have at least 3 letter characters
  const letters = line.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 3) return false;

  // All letters must be uppercase
  if (letters !== letters.toUpperCase()) return false;

  // Should not be just a number-like string
  if (/^\d+$/.test(line)) return false;

  return true;
}

function detectBySectionBreaks(text: string): RawChapter[] {
  // Split on 3+ consecutive blank lines
  const sections = text.split(/\n{4,}/);

  if (sections.length <= 1) return [];

  return sections
    .map((content, idx) => ({
      title: `Section ${idx + 1}`,
      content: content.trim(),
    }))
    .filter((ch) => ch.content.length > 0);
}
