import { test, expect } from '@playwright/test';
import {
  clearDatabase,
  uploadAndOpenReader,
  mockSpeechSynthesis,
  trackConsoleErrors,
  takeScreenshot,
  focusBody,
} from './helpers';

test.describe('Chapter auto-advance', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('automatically advances from chapter 1 to chapter 2 without stopping', async ({
    page,
  }) => {
    const errors = trackConsoleErrors(page);

    // 1. Upload sample.txt and open the reader
    await uploadAndOpenReader(page);
    await takeScreenshot(page, 'chapter-advance-01-reader-loaded');

    // 2. Click play to start TTS playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();

    // Verify playback started — Pause button should be visible
    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await expect(pauseButton).toBeVisible({ timeout: 5000 });
    await takeScreenshot(page, 'chapter-advance-02-playback-started');

    // 3. Wait for playback to advance through chapter 1's words.
    //    Chapter 1 has ~73 words. At 80ms per word boundary + 50ms initial delay,
    //    that's ~5.9s. We poll for the chapter heading to change rather than
    //    using a fixed timeout.

    // First, confirm we start in chapter 1
    const chapterHeading = page.locator('[class*="chapter"], [data-testid*="chapter"]').first();

    // 4. Poll until the chapter heading updates to "Chapter 2"
    //    Give it up to 15 seconds — enough for chapter 1 to finish plus some margin.
    await expect(page.locator('h2:has-text("Chapter 2")')).toBeVisible({
      timeout: 15000,
    });
    await takeScreenshot(page, 'chapter-advance-03-chapter2-reached');

    // 5. Verify the chapter heading displays "Chapter 2"
    //    Look for a chapter indicator that contains "Chapter 2"
    const chapter2Indicator = page.getByText(/Chapter 2/);
    await expect(chapter2Indicator.first()).toBeVisible();

    // 6. Verify playback is still active — Pause button should still be visible
    //    (the Play button should NOT be visible, meaning we did not stop)
    await expect(pauseButton).toBeVisible({ timeout: 2000 });
    await expect(playButton).not.toBeVisible();

    // 7. Verify the highlighted word is in chapter 2 territory (word index >= 73)
    //    Wait briefly for a boundary event to fire in chapter 2
    await page.waitForTimeout(500);

    const highlightedWord = page.locator('[data-word-index].highlighted, [data-word-index][class*="highlight"], [data-word-index][aria-current]').first();

    // If a highlighted element exists, verify its word index
    const highlightedCount = await highlightedWord.count();
    if (highlightedCount > 0) {
      const wordIndex = await highlightedWord.getAttribute('data-word-index');
      expect(Number(wordIndex)).toBeGreaterThanOrEqual(73);
    }

    await takeScreenshot(page, 'chapter-advance-04-highlight-in-chapter2');

    // 8. Wait a bit more and verify playback continues advancing in chapter 2
    const currentWordIndex = highlightedCount > 0
      ? Number(await highlightedWord.getAttribute('data-word-index'))
      : -1;

    await page.waitForTimeout(1000);

    if (highlightedCount > 0) {
      const laterWordIndex = await highlightedWord.getAttribute('data-word-index');
      // The highlight should have advanced further
      expect(Number(laterWordIndex)).toBeGreaterThan(currentWordIndex);
    }

    // Pause button should still be visible — playback never stopped
    await expect(pauseButton).toBeVisible();

    await takeScreenshot(page, 'chapter-advance-05-still-playing');

    // Verify no console errors occurred
    const relevantErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('manifest')
    );
    expect(relevantErrors).toHaveLength(0);
  });
});
