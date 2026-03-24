import type { Word } from '@/types';

/**
 * Tokenize a block of text into Word objects.
 *
 * @param text - The raw text to tokenize
 * @param chapterIndex - Chapter index to assign to each word
 * @param globalStartIndex - Starting global word index
 * @returns Array of Word objects
 */
export function tokenizeText(
  text: string,
  chapterIndex: number,
  globalStartIndex: number
): Word[] {
  const words: Word[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let runningIndex = 0;

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const paragraph = paragraphs[pIdx];
    const tokens = paragraph.split(/\s+/).filter((t) => t.length > 0);

    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      const isParagraphBreak = pIdx > 0 && tIdx === 0;

      words.push({
        index: globalStartIndex + runningIndex,
        text: tokens[tIdx],
        chapterIndex,
        paragraphBreakBefore: isParagraphBreak,
      });

      runningIndex++;
    }
  }

  return words;
}

/**
 * Quick word count without creating Word objects.
 */
export function countWordsInText(text: string): number {
  return text.split(/\s+/).filter((t) => t.length > 0).length;
}
