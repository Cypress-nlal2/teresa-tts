import { test, expect, Page } from '@playwright/test';
import {
  clearDatabase,
  trackConsoleErrors,
  uploadAndOpenReader,
  mockSpeechSynthesis,
  takeScreenshot,
} from './helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getHighlightedWordIndex(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-active="true"]');
    if (!el) return null;
    return parseInt(el.getAttribute('data-word-index') || '-1', 10);
  });
}

async function getHighlightedWordText(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-active="true"]');
    if (!el) return null;
    return el.textContent?.trim() || null;
  });
}

async function waitForHighlight(page: Page, timeout = 5000): Promise<number> {
  await page.waitForSelector('[data-active="true"]', { timeout });
  const idx = await getHighlightedWordIndex(page);
  return idx ?? -1;
}

async function waitForHighlightChange(
  page: Page,
  currentIndex: number,
  timeout = 5000,
): Promise<number> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const idx = await getHighlightedWordIndex(page);
    if (idx !== null && idx !== currentIndex) return idx;
    await page.waitForTimeout(50);
  }
  throw new Error(
    `Highlight did not change from index ${currentIndex} within ${timeout}ms`,
  );
}

/** Wait for a specific word index to appear as highlighted */
async function waitForHighlightAtIndex(
  page: Page,
  targetIndex: number,
  timeout = 5000,
): Promise<void> {
  await page.waitForSelector(`[data-word-index="${targetIndex}"][data-active="true"]`, { timeout });
}

async function getHighlightCount(page: Page): Promise<number> {
  return page.locator('[data-active="true"]').count();
}

async function assertSingleHighlight(page: Page) {
  const count = await getHighlightCount(page);
  expect(count).toBeLessThanOrEqual(1);
}

/** Wait for word elements to be rendered (after a chapter change) */
async function waitForWordsToRender(page: Page, timeout = 10000): Promise<void> {
  await page.locator('[data-word-index]').first().waitFor({ state: 'visible', timeout });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Highlight Sync', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('1 - initial load highlights first word', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    const idx = await waitForHighlight(page);
    expect(idx).toBe(0);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-initial-load');
    expect(consoleErrors).toEqual([]);
  });

  test('2 - play starts and highlight advances', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();

    const newIdx = await waitForHighlightChange(page, 0);
    expect(newIdx).toBeGreaterThan(0);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-play-advances');
    expect(consoleErrors).toEqual([]);
  });

  test('3 - pause preserves highlight position', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Play and wait for highlight to advance
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await waitForHighlightChange(page, 0);
    // Wait a bit more to advance further
    await page.waitForTimeout(300);

    // Pause
    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await pauseButton.click();
    // Wait for pause to take effect
    await expect(page.getByRole('button', { name: /^Play$/i })).toBeVisible({ timeout: 5000 });

    // Record position AFTER pause (the engine confirms position on pause)
    const posAfterPause = await getHighlightedWordIndex(page);
    expect(posAfterPause).not.toBeNull();
    expect(posAfterPause!).toBeGreaterThan(0);

    // Wait and verify it stays the same
    await page.waitForTimeout(500);
    const posLater = await getHighlightedWordIndex(page);
    expect(posLater).toBe(posAfterPause);

    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-pause-preserves');
    expect(consoleErrors).toEqual([]);
  });

  test('4 - resume after pause continues from correct position', async ({
    page,
  }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Play, advance, pause
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await waitForHighlightChange(page, 0);
    await page.waitForTimeout(200);

    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await pauseButton.click();
    await expect(page.getByRole('button', { name: /^Play$/i })).toBeVisible({
      timeout: 5000,
    });

    const pausedPos = await getHighlightedWordIndex(page);
    expect(pausedPos).not.toBeNull();
    expect(pausedPos!).toBeGreaterThan(0);

    // Resume
    const resumeButton = page.getByRole('button', { name: /^Play$/i });
    await resumeButton.click();

    // Wait for the pause button to reappear (confirms playback resumed)
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // The engine immediately confirms the current position on resume.
    // A highlight should still exist after resume.
    await page.waitForTimeout(500);
    const newIdx = await getHighlightedWordIndex(page);
    expect(newIdx).not.toBeNull();
    // The highlight should be at a non-zero position (not reset to start)
    expect(newIdx!).toBeGreaterThan(0);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-resume-continues');
    expect(consoleErrors).toEqual([]);
  });

  test('5 - skip forward moves highlight forward', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    const initialIdx = await waitForHighlight(page);

    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await skipForward.click();

    // Skip forward is 75 words which may cross into chapter 2.
    // Wait for the new words to render and highlight to appear.
    await page.waitForTimeout(500);
    await waitForWordsToRender(page);
    const newIdx = await waitForHighlight(page, 10000);

    expect(newIdx).toBeGreaterThan(initialIdx);
    // Skip forward is 75 words, so the jump should be significant
    expect(newIdx - initialIdx).toBeGreaterThanOrEqual(10);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-skip-forward');
    expect(consoleErrors).toEqual([]);
  });

  test('6 - skip backward moves highlight backward', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Skip forward first to get away from start
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await skipForward.click();
    await page.waitForTimeout(500);
    await waitForWordsToRender(page);
    const afterForwardIdx = await waitForHighlight(page, 10000);
    expect(afterForwardIdx).toBeGreaterThan(0);

    // Skip backward (25 words)
    const skipBackward = page.getByRole('button', {
      name: /^Skip backward$/i,
    });
    await skipBackward.click();
    await page.waitForTimeout(500);
    await waitForWordsToRender(page);
    const afterBackwardIdx = await waitForHighlight(page, 10000);

    expect(afterBackwardIdx).toBeLessThan(afterForwardIdx);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-skip-backward');
    expect(consoleErrors).toEqual([]);
  });

  test('7 - next chapter updates highlight to new chapter', async ({
    page,
  }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    const ch1Idx = await waitForHighlight(page);

    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await nextChapter.click();

    // Wait for new chapter words to render from IndexedDB
    await page.waitForTimeout(1000);
    await waitForWordsToRender(page);
    const newIdx = await waitForHighlight(page, 10000);

    // Chapter 2 words should have higher global indices than chapter 1's start
    expect(newIdx).toBeGreaterThan(ch1Idx);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-next-chapter');
    expect(consoleErrors).toEqual([]);
  });

  test('8 - previous chapter updates highlight to previous chapter', async ({
    page,
  }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Go to chapter 2
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await nextChapter.click();
    await page.waitForTimeout(1000);
    await waitForWordsToRender(page);
    const ch2Idx = await waitForHighlight(page, 10000);

    // Go back to chapter 1
    const prevChapter = page.getByRole('button', {
      name: /^Previous chapter$/i,
    });
    await prevChapter.click();
    await page.waitForTimeout(1000);
    await waitForWordsToRender(page);
    const ch1Idx = await waitForHighlight(page, 10000);

    expect(ch1Idx).toBeLessThan(ch2Idx);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-prev-chapter');
    expect(consoleErrors).toEqual([]);
  });

  test('9 - click on a word seeks to it', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Find a word that is NOT currently highlighted (e.g. word index 5)
    const targetWord = page.locator('[data-word-index="5"]');
    await expect(targetWord).toBeVisible();
    await targetWord.click();
    await page.waitForTimeout(300);

    const idx = await getHighlightedWordIndex(page);
    expect(idx).toBe(5);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-word-click');
    expect(consoleErrors).toEqual([]);
  });

  test('10 - speed change preserves highlight position', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Play and advance, then pause
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await waitForHighlightChange(page, 0);
    await page.waitForTimeout(200);

    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await pauseButton.click();
    await expect(page.getByRole('button', { name: /^Play$/i })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    const posBeforeSpeed = await getHighlightedWordIndex(page);
    expect(posBeforeSpeed).not.toBeNull();

    // Open speed control and change speed
    const speedButton = page.getByRole('button', { name: /Adjust speed/i });
    await speedButton.click();
    await page.waitForTimeout(200);

    const preset = page.getByRole('button', { name: /Set speed to 1\.5x/i });
    await expect(preset).toBeVisible({ timeout: 3000 });
    await preset.click();
    await page.waitForTimeout(300);

    const posAfterSpeed = await getHighlightedWordIndex(page);
    expect(posAfterSpeed).toBe(posBeforeSpeed);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-speed-change');
    expect(consoleErrors).toEqual([]);
  });

  test('11 - only one highlight exists at any time', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);
    await assertSingleHighlight(page);

    // Play
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await waitForHighlightChange(page, 0);
    await assertSingleHighlight(page);

    // Pause
    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await pauseButton.click();
    await expect(page.getByRole('button', { name: /^Play$/i })).toBeVisible({ timeout: 5000 });
    await assertSingleHighlight(page);

    // Word click
    const targetWord = page.locator('[data-word-index="3"]');
    await targetWord.click();
    await page.waitForTimeout(300);
    await assertSingleHighlight(page);

    // Next chapter
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await nextChapter.click();
    await page.waitForTimeout(1000);
    await waitForWordsToRender(page);
    await assertSingleHighlight(page);

    await takeScreenshot(page, 'highlight-sync-single-highlight');
    expect(consoleErrors).toEqual([]);
  });

  test('12 - play after skip keeps highlight in sync', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Use a smaller seek via word click to stay in chapter 1
    const targetWord = page.locator('[data-word-index="10"]');
    await expect(targetWord).toBeVisible();
    await targetWord.click();
    await page.waitForTimeout(300);

    const seekedIdx = await getHighlightedWordIndex(page);
    expect(seekedIdx).toBe(10);

    // Play from seeked position
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();

    const advancedIdx = await waitForHighlightChange(page, seekedIdx!);
    // Highlight should advance from the seeked position, not from 0
    expect(advancedIdx).toBeGreaterThanOrEqual(seekedIdx!);
    await assertSingleHighlight(page);
    await takeScreenshot(page, 'highlight-sync-play-after-skip');
    expect(consoleErrors).toEqual([]);
  });

  test('13 - rapid skip does not desync', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Use skip backward to stay within a chapter (start from a seeked position first)
    // First seek to word 10 so we have a known starting point
    const targetWord = page.locator('[data-word-index="10"]');
    await expect(targetWord).toBeVisible();
    await targetWord.click();
    await page.waitForTimeout(300);

    // Rapid skip forward 3 times (75 words each = 225 total from word 10)
    // This will likely cross chapter boundaries, so we need to wait for
    // chapter changes to settle
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await skipForward.click();
    await page.waitForTimeout(200);
    await skipForward.click();
    await page.waitForTimeout(200);
    await skipForward.click();

    // Wait for chapter transitions to settle
    await page.waitForTimeout(1500);
    await waitForWordsToRender(page);

    await assertSingleHighlight(page);
    const finalIdx = await waitForHighlight(page, 10000);
    // After 3 skips of 75 words from position 10, should be well past start
    expect(finalIdx).toBeGreaterThanOrEqual(50);
    await takeScreenshot(page, 'highlight-sync-rapid-skip');
    expect(consoleErrors).toEqual([]);
  });
});
