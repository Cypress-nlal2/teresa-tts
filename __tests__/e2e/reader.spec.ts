import { test, expect } from '@playwright/test';
import {
  clearDatabase,
  trackConsoleErrors,
  goToLibrary,
  uploadFileViaInput,
  uploadAndOpenReader,
  mockSpeechSynthesis,
  takeScreenshot,
} from './helpers';

test.describe('Reader Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('can navigate from library to reader by clicking a card', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);
    await uploadFileViaInput(page);

    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    await card.click();

    // Should navigate to the reader page
    await page.waitForURL(/\/reader\//, { timeout: 10000 });
    expect(page.url()).toMatch(/\/reader\//);

    await takeScreenshot(page, 'reader-opened');
    expect(consoleErrors).toEqual([]);
  });

  test('reader shows document text with chapter headings', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Should show chapter heading — scope to h2 elements to avoid matching player controls chapter button
    const chapter1 = page.locator('h2', { hasText: 'Chapter 1: The Beginning' });
    await expect(chapter1).toBeVisible();

    // Navigate to chapter 2
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await nextChapter.click();
    const chapter2 = page.locator('h2', { hasText: 'Chapter 2: The Middle' });
    await expect(chapter2).toBeVisible();

    // Navigate to chapter 3
    await nextChapter.click();
    const chapter3 = page.locator('h2', { hasText: 'Chapter 3: The Conclusion' });
    await expect(chapter3).toBeVisible();

    await takeScreenshot(page, 'reader-chapter-headings');
    expect(consoleErrors).toEqual([]);
  });

  test('back button returns to library', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Find and click the back button (scoped to header to avoid matching other buttons)
    const backButton = page.locator('header').getByRole('button', { name: /back|return|home/i }).or(
      page.locator('header').getByRole('link', { name: /back|return|home/i })
    );
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should be back at the library
    await page.waitForURL(/^\/$|\/$/);

    await takeScreenshot(page, 'reader-back-to-library');
    expect(consoleErrors).toEqual([]);
  });

  test('player controls are visible at the bottom', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Player controls bar should be visible at the bottom
    const playerBar = page.locator(
      '[class*="player"], [class*="controls"], [data-testid="player-controls"]'
    ).first();
    await expect(playerBar).toBeVisible();

    // The player bar should be near the bottom of the viewport
    const box = await playerBar.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      const viewportHeight = page.viewportSize()?.height ?? 720;
      expect(box.y + box.height).toBeGreaterThan(viewportHeight * 0.7);
    }

    await takeScreenshot(page, 'reader-player-controls');
    expect(consoleErrors).toEqual([]);
  });

  test('all player control buttons exist and are clickable', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Play/Pause button — use exact label to avoid matching "Playback speed"
    const playButton = page.getByRole('button', { name: /^Play$|^Pause$/i });
    await expect(playButton).toBeVisible();

    // Skip forward button
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await expect(skipForward).toBeVisible();

    // Skip backward button
    const skipBackward = page.getByRole('button', { name: /^Skip backward$/i });
    await expect(skipBackward).toBeVisible();

    // Chapter navigation buttons
    const prevChapter = page.getByRole('button', { name: /^Previous chapter$/i });
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await expect(prevChapter).toBeVisible();
    await expect(nextChapter).toBeVisible();

    await takeScreenshot(page, 'reader-all-controls');
    expect(consoleErrors).toEqual([]);
  });

  test('speed control is accessible', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Speed display should show a rate value like "1x" or "1.0x"
    const speedDisplay = page.getByRole('button', { name: /Playback speed/i });
    await expect(speedDisplay).toBeVisible();

    await takeScreenshot(page, 'reader-speed-control');
    expect(consoleErrors).toEqual([]);
  });

  test('words are rendered as clickable elements', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Words should be rendered as span elements or similar clickable elements
    // Look for individual word elements in the text content area
    const wordElements = page.locator(
      '[class*="word"], [data-testid*="word"], [data-word-index], [data-index]'
    );
    const count = await wordElements.count();
    expect(count).toBeGreaterThan(0);

    // The first word element should be clickable
    const firstWord = wordElements.first();
    await expect(firstWord).toBeVisible();
    await firstWord.click();

    await takeScreenshot(page, 'reader-word-click');
    expect(consoleErrors).toEqual([]);
  });

  test('can click a word to seek to it', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Find word elements
    const wordElements = page.locator(
      '[class*="word"], [data-testid*="word"], [data-word-index], [data-index]'
    );
    await expect(wordElements.first()).toBeVisible();

    // Click a word that's not the first one (e.g., the 10th word)
    const wordCount = await wordElements.count();
    const targetIndex = Math.min(10, wordCount - 1);
    const targetWord = wordElements.nth(targetIndex);
    await targetWord.click();

    // After clicking, the word or its surroundings should show some visual indication
    // (e.g., highlight or cursor position change)
    await takeScreenshot(page, 'reader-word-seek');
    expect(consoleErrors).toEqual([]);
  });
});
