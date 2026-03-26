import { test, expect, Page } from '@playwright/test';
import {
  clearDatabase,
  uploadAndOpenReader,
  mockSpeechSynthesis,
  trackConsoleErrors,
  takeScreenshot,
} from './helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getHighlightIndex(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-active="true"]');
    return el ? parseInt(el.getAttribute('data-word-index') || '-1', 10) : null;
  });
}

async function getChapterHeading(page: Page): Promise<string> {
  return page.evaluate(() => {
    const h2 = document.querySelector('h2');
    return h2?.textContent || '';
  });
}

async function getFirstRenderedWordIndex(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-word-index]');
    return el ? parseInt(el.getAttribute('data-word-index') || '-1', 10) : null;
  });
}

async function waitForHighlight(page: Page, timeout = 5000): Promise<number> {
  await page.waitForSelector('[data-active="true"]', { timeout });
  const idx = await getHighlightIndex(page);
  return idx ?? -1;
}

async function waitForHighlightChange(
  page: Page,
  currentIndex: number,
  timeout = 5000,
): Promise<number> {
  await page.waitForFunction(
    (prevIdx) => {
      const el = document.querySelector('[data-active="true"]');
      if (!el) return false;
      const idx = parseInt(el.getAttribute('data-word-index') || '-1', 10);
      return idx !== prevIdx && idx >= 0;
    },
    currentIndex,
    { timeout },
  );
  const idx = await getHighlightIndex(page);
  return idx ?? -1;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Chapter skip positions at chapter start', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('next chapter positions at chapter start', async ({ page }) => {
    const errors = trackConsoleErrors(page);

    // 1. Upload and open reader — starts on chapter 1
    await uploadAndOpenReader(page);

    // Verify chapter 1 heading is visible
    const chapter1Heading = page.locator('h2', { hasText: 'Chapter 1' });
    await expect(chapter1Heading).toBeVisible();
    await takeScreenshot(page, 'chapter-skip-01-chapter1-loaded');

    // 2. Click "Next chapter" to navigate to chapter 2
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await nextChapter.click();

    // 3. Wait for chapter 2 to load
    const chapter2Heading = page.locator('h2', { hasText: 'Chapter 2' });
    await expect(chapter2Heading).toBeVisible({ timeout: 5000 });
    await takeScreenshot(page, 'chapter-skip-02-chapter2-loaded');

    // 4. Verify heading says "Chapter 2"
    const heading = await getChapterHeading(page);
    expect(heading).toContain('Chapter 2');

    // 5. Verify highlight is on the FIRST word of chapter 2
    //    The first rendered word index should match the highlight index
    const firstWordIndex = await getFirstRenderedWordIndex(page);
    expect(firstWordIndex).not.toBeNull();

    const highlightIndex = await getHighlightIndex(page);
    // The highlight should be on the first word rendered in the DOM
    // (i.e., the first word of chapter 2)
    expect(highlightIndex).toEqual(firstWordIndex);

    await takeScreenshot(page, 'chapter-skip-03-highlight-at-start');

    const relevantErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('manifest'),
    );
    expect(relevantErrors).toHaveLength(0);
  });

  test('previous chapter positions at chapter start', async ({ page }) => {
    const errors = trackConsoleErrors(page);

    // 1. Upload and open reader — starts on chapter 1
    await uploadAndOpenReader(page);

    // 2. Navigate to chapter 2 first
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await nextChapter.click();

    const chapter2Heading = page.locator('h2', { hasText: 'Chapter 2' });
    await expect(chapter2Heading).toBeVisible({ timeout: 5000 });

    // 3. Click "Previous chapter" to go back to chapter 1
    const prevChapter = page.getByRole('button', { name: /^Previous chapter$/i });
    await prevChapter.click();

    // 4. Wait for chapter 1 to load
    const chapter1Heading = page.locator('h2', { hasText: 'Chapter 1' });
    await expect(chapter1Heading).toBeVisible({ timeout: 5000 });
    await takeScreenshot(page, 'chapter-skip-04-back-to-chapter1');

    // 5. Verify heading says "Chapter 1"
    const heading = await getChapterHeading(page);
    expect(heading).toContain('Chapter 1');

    // 6. Verify highlight is on word index 0 (first word of chapter 1)
    const highlightIndex = await getHighlightIndex(page);
    expect(highlightIndex).toEqual(0);

    const relevantErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('manifest'),
    );
    expect(relevantErrors).toHaveLength(0);
  });

  test('play after next chapter reads from chapter start', async ({ page }) => {
    const errors = trackConsoleErrors(page);

    // 1. Upload and open reader
    await uploadAndOpenReader(page);

    // 2. Navigate to chapter 2
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await nextChapter.click();

    const chapter2Heading = page.locator('h2', { hasText: 'Chapter 2' });
    await expect(chapter2Heading).toBeVisible({ timeout: 5000 });

    // Record the first word index of chapter 2
    const firstWordOfChapter2 = await getFirstRenderedWordIndex(page);
    expect(firstWordOfChapter2).not.toBeNull();

    // 3. Click play
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();

    // Verify playback started
    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await expect(pauseButton).toBeVisible({ timeout: 5000 });
    await takeScreenshot(page, 'chapter-skip-05-playing-chapter2');

    // 4. Wait for highlight to appear and advance
    const initialHighlight = await waitForHighlight(page, 5000);

    // The highlight should be in chapter 2's range (at or after the first word)
    expect(initialHighlight).toBeGreaterThanOrEqual(firstWordOfChapter2!);

    // 5. Wait for highlight to advance further — confirms reading is progressing
    const advancedHighlight = await waitForHighlightChange(page, initialHighlight, 5000);
    expect(advancedHighlight).toBeGreaterThan(initialHighlight);

    // Still in chapter 2 range
    expect(advancedHighlight).toBeGreaterThanOrEqual(firstWordOfChapter2!);

    await takeScreenshot(page, 'chapter-skip-06-highlight-advancing-in-chapter2');

    const relevantErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('manifest'),
    );
    expect(relevantErrors).toHaveLength(0);
  });

  test('next chapter while playing continues from new chapter', async ({ page }) => {
    const errors = trackConsoleErrors(page);

    // 1. Upload and open reader
    await uploadAndOpenReader(page);

    // 2. Start playing in chapter 1
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();

    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await expect(pauseButton).toBeVisible({ timeout: 5000 });

    // 3. Wait for some words to be read in chapter 1
    const ch1Highlight = await waitForHighlight(page, 5000);
    await waitForHighlightChange(page, ch1Highlight, 5000);
    await takeScreenshot(page, 'chapter-skip-07-playing-chapter1');

    // 4. Click "Next chapter" while playing
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await nextChapter.click();

    // 5. Wait for chapter 2 to load
    const chapter2Heading = page.locator('h2', { hasText: 'Chapter 2' });
    await expect(chapter2Heading).toBeVisible({ timeout: 5000 });
    await takeScreenshot(page, 'chapter-skip-08-jumped-to-chapter2');

    // 6. Verify playback continues — Pause button should still be visible
    await expect(pauseButton).toBeVisible({ timeout: 5000 });

    // 7. Get first word index of chapter 2
    const firstWordOfChapter2 = await getFirstRenderedWordIndex(page);
    expect(firstWordOfChapter2).not.toBeNull();

    // 8. Verify highlight is in chapter 2's word range
    const ch2Highlight = await waitForHighlight(page, 5000);
    expect(ch2Highlight).toBeGreaterThanOrEqual(firstWordOfChapter2!);

    // 9. Wait for highlight to advance — confirms reading is progressing in chapter 2
    const advancedHighlight = await waitForHighlightChange(page, ch2Highlight, 5000);
    expect(advancedHighlight).toBeGreaterThan(ch2Highlight);
    expect(advancedHighlight).toBeGreaterThanOrEqual(firstWordOfChapter2!);

    await takeScreenshot(page, 'chapter-skip-09-advancing-in-chapter2');

    const relevantErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('manifest'),
    );
    expect(relevantErrors).toHaveLength(0);
  });

  test('skip to chapter 3 then back to chapter 1', async ({ page }) => {
    const errors = trackConsoleErrors(page);

    // 1. Upload and open reader
    await uploadAndOpenReader(page);

    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    const prevChapter = page.getByRole('button', { name: /^Previous chapter$/i });

    // 2. Click next chapter twice to reach chapter 3
    await nextChapter.click();
    const chapter2Heading = page.locator('h2', { hasText: 'Chapter 2' });
    await expect(chapter2Heading).toBeVisible({ timeout: 5000 });

    await nextChapter.click();
    const chapter3Heading = page.locator('h2', { hasText: 'Chapter 3' });
    await expect(chapter3Heading).toBeVisible({ timeout: 5000 });

    // 3. Verify chapter 3 heading
    let heading = await getChapterHeading(page);
    expect(heading).toContain('Chapter 3');
    await takeScreenshot(page, 'chapter-skip-10-chapter3');

    // 4. Click previous chapter twice to return to chapter 1
    await prevChapter.click();
    await expect(chapter2Heading).toBeVisible({ timeout: 5000 });

    await prevChapter.click();
    const chapter1Heading = page.locator('h2', { hasText: 'Chapter 1' });
    await expect(chapter1Heading).toBeVisible({ timeout: 5000 });

    // 5. Verify chapter 1 heading
    heading = await getChapterHeading(page);
    expect(heading).toContain('Chapter 1');
    await takeScreenshot(page, 'chapter-skip-11-back-to-chapter1');

    // 6. Verify highlight is at word 0
    const highlightIndex = await getHighlightIndex(page);
    expect(highlightIndex).toEqual(0);

    const relevantErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('manifest'),
    );
    expect(relevantErrors).toHaveLength(0);
  });
});
