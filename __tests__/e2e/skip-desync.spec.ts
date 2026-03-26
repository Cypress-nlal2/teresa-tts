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

async function getHighlightIndex(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-active="true"]');
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
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const idx = await getHighlightIndex(page);
    if (idx !== null && idx !== currentIndex) return idx;
    await page.waitForTimeout(50);
  }
  throw new Error(
    `Highlight did not change from index ${currentIndex} within ${timeout}ms`,
  );
}

async function getHighlightCount(page: Page): Promise<number> {
  return page.locator('[data-active="true"]').count();
}

async function waitForWordsToRender(page: Page, timeout = 10000): Promise<void> {
  await page.locator('[data-word-index]').first().waitFor({ state: 'visible', timeout });
}

// ---------------------------------------------------------------------------
// Tests — Skip desync (Bug 2)
// ---------------------------------------------------------------------------

test.describe('Skip Desync — voice and highlight stay in sync', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('1 - skip forward while playing keeps sync', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Start playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // Wait for a few boundary events to fire so highlight advances
    await waitForHighlightChange(page, 0);
    await page.waitForTimeout(300);

    // Record the pre-skip highlighted word index
    const preSkipIndex = await getHighlightIndex(page);
    expect(preSkipIndex).not.toBeNull();
    expect(preSkipIndex!).toBeGreaterThan(0);

    // Click skip forward
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await skipForward.click();

    // Wait for state to settle (chapter may change, words re-render)
    await page.waitForTimeout(500);
    await waitForWordsToRender(page);

    // Record the post-skip highlighted word index — should be significantly ahead
    const postSkipIndex = await waitForHighlight(page, 10000);
    expect(postSkipIndex).toBeGreaterThan(preSkipIndex!);
    // Skip forward is ~75 words, so the jump should be substantial
    expect(postSkipIndex - preSkipIndex!).toBeGreaterThanOrEqual(10);

    // Continue playing for 1-2 seconds and verify highlight advances from new position
    await page.waitForTimeout(1500);
    const advancedIndex = await getHighlightIndex(page);
    expect(advancedIndex).not.toBeNull();
    // The highlighted word index should be > the post-skip index (advancing)
    expect(advancedIndex!).toBeGreaterThan(postSkipIndex);

    await takeScreenshot(page, 'skip-desync-forward-while-playing');
    expect(consoleErrors).toEqual([]);
  });

  test('2 - skip backward while playing keeps sync', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Start playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // Wait for playback to advance a bit
    await waitForHighlightChange(page, 0);
    await page.waitForTimeout(200);

    // Skip forward first to get away from start (so skip backward has room)
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await skipForward.click();
    await page.waitForTimeout(500);
    await waitForWordsToRender(page);
    const afterForwardIndex = await waitForHighlight(page, 10000);
    expect(afterForwardIndex).toBeGreaterThan(0);

    // Record position before skip backward
    const preBackwardIndex = afterForwardIndex;

    // Click skip backward
    const skipBackward = page.getByRole('button', { name: /^Skip backward$/i });
    await skipBackward.click();
    await page.waitForTimeout(500);
    await waitForWordsToRender(page);

    // New position should be less than previous
    const postBackwardIndex = await waitForHighlight(page, 10000);
    expect(postBackwardIndex).toBeLessThan(preBackwardIndex);

    // Continue playing — highlight should advance from the backward-skipped position
    await page.waitForTimeout(1500);
    const advancedIndex = await getHighlightIndex(page);
    expect(advancedIndex).not.toBeNull();
    expect(advancedIndex!).toBeGreaterThan(postBackwardIndex);

    await takeScreenshot(page, 'skip-desync-backward-while-playing');
    expect(consoleErrors).toEqual([]);
  });

  test('3 - multiple rapid skips maintain sync', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Start playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // Wait for playback to start
    await waitForHighlightChange(page, 0);

    // Click skip forward 3 times rapidly
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await skipForward.click();
    await skipForward.click();
    await skipForward.click();

    // Wait for state to settle
    await page.waitForTimeout(500);
    await waitForWordsToRender(page);

    // Verify exactly 1 highlight exists
    const highlightCount = await getHighlightCount(page);
    expect(highlightCount).toBe(1);

    // Record the triple-skip position
    const tripleSkipIndex = await waitForHighlight(page, 10000);
    // After 3 skips of ~75 words each, should be well past start
    expect(tripleSkipIndex).toBeGreaterThanOrEqual(50);

    // Play for 1-2 seconds and verify highlight advances from the triple-skipped position
    await page.waitForTimeout(1500);
    const advancedIndex = await getHighlightIndex(page);
    expect(advancedIndex).not.toBeNull();
    expect(advancedIndex!).toBeGreaterThan(tripleSkipIndex);

    await takeScreenshot(page, 'skip-desync-rapid-skips');
    expect(consoleErrors).toEqual([]);
  });

  test('4 - skip while paused then play', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await waitForHighlight(page);

    // Start playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // Wait for highlight to advance
    await waitForHighlightChange(page, 0);
    await page.waitForTimeout(300);

    // Pause
    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await pauseButton.click();
    await expect(page.getByRole('button', { name: /^Play$/i })).toBeVisible({ timeout: 5000 });

    // Record paused position
    const pausedIndex = await getHighlightIndex(page);
    expect(pausedIndex).not.toBeNull();
    expect(pausedIndex!).toBeGreaterThan(0);

    // Skip forward while paused
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await skipForward.click();
    await page.waitForTimeout(500);
    await waitForWordsToRender(page);

    // New position should be ahead of paused position
    const postSkipIndex = await waitForHighlight(page, 10000);
    expect(postSkipIndex).toBeGreaterThan(pausedIndex!);

    // Click play to resume from the skipped position
    const resumeButton = page.getByRole('button', { name: /^Play$/i });
    await resumeButton.click();
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // Wait 1-2 seconds for the voice to play from the skipped position
    await page.waitForTimeout(1500);

    // Verify the voice starts from the skipped position (highlight advances from there)
    const advancedIndex = await getHighlightIndex(page);
    expect(advancedIndex).not.toBeNull();
    expect(advancedIndex!).toBeGreaterThan(postSkipIndex);

    await takeScreenshot(page, 'skip-desync-paused-then-play');
    expect(consoleErrors).toEqual([]);
  });
});
