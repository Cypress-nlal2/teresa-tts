/**
 * Normalize raw text for TTS consumption.
 *
 * - Remove page numbers (bare numbers, "Page X", "- X -")
 * - Fix hyphenation at line breaks (word-\n continuation -> joined word)
 * - Collapse multiple blank lines to max 2
 * - Remove null / control characters (except newline, tab, carriage return)
 * - Trim individual lines but preserve paragraph structure
 * - Normalize Unicode whitespace to standard spaces
 */
export function normalizeText(text: string): string {
  let result = text;

  // Strip HTML tags (defense-in-depth against XSS)
  result = result.replace(/<[^>]*>/g, '');

  // Remove null / control characters (keep \n \r \t)
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize Unicode whitespace (non-breaking space, em space, etc.) to regular space
  result = result.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // Fix hyphenation at line breaks: "word-\n continuation" -> "wordcontinuation"
  // Only join when the next line starts with a lowercase letter (indicates a broken word)
  result = result.replace(/-\s*\r?\n\s*([a-z])/g, '$1');

  // Remove page number patterns (entire lines)
  result = result
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();

      // Line is just a bare number (page number)
      if (/^\d{1,5}$/.test(trimmed)) return '';

      // "Page X" or "page X"
      if (/^page\s+\d+$/i.test(trimmed)) return '';

      // "- X -" pattern
      if (/^-\s*\d+\s*-$/.test(trimmed)) return '';

      return line;
    })
    .join('\n');

  // Trim each line (preserve blank lines for paragraph detection)
  result = result
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  // Collapse 3+ consecutive blank lines to 2
  result = result.replace(/\n{4,}/g, '\n\n\n');

  // Trim leading/trailing whitespace from the whole text
  result = result.trim();

  return result;
}
