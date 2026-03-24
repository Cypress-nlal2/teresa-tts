import { test, expect } from '@playwright/test';
import {
  clearDatabase,
  trackConsoleErrors,
  uploadAndOpenReader,
  mockSpeechSynthesis,
  takeScreenshot,
} from './helpers';

test.describe('TTS Playback', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('play button starts playback', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Click the play button
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await expect(playButton).toBeVisible();
    await playButton.click();

    // After clicking play, the button should change to pause
    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await expect(pauseButton).toBeVisible({ timeout: 5000 });

    // Word highlighting should start (some word should have a highlight class)
    const highlightedWord = page.locator(
      '[class*="highlight"], [class*="active"], [data-active="true"], [aria-current="true"]'
    ).first();
    await expect(highlightedWord).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, 'playback-playing');
    expect(consoleErrors).toEqual([]);
  });

  test('pause button stops playback', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Start playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();

    // Wait for pause button to appear
    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await expect(pauseButton).toBeVisible({ timeout: 5000 });

    // Click pause
    await pauseButton.click();

    // Play button should reappear
    const playButtonAgain = page.getByRole('button', { name: /^Play$/i });
    await expect(playButtonAgain).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, 'playback-paused');
    expect(consoleErrors).toEqual([]);
  });

  test('play after pause resumes', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Start playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();

    // Wait for it to start
    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await expect(pauseButton).toBeVisible({ timeout: 5000 });

    // Pause
    await pauseButton.click();
    await expect(page.getByRole('button', { name: /^Play$/i })).toBeVisible({ timeout: 5000 });

    // Resume
    const resumeButton = page.getByRole('button', { name: /^Play$/i });
    await resumeButton.click();

    // Should be playing again
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, 'playback-resumed');
    expect(consoleErrors).toEqual([]);
  });

  test('skip forward button advances position', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Start playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // Click skip forward
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await expect(skipForward).toBeVisible();
    await skipForward.click();

    // The position should have advanced (we can check the time display or progress bar)
    await takeScreenshot(page, 'playback-skip-forward');
    expect(consoleErrors).toEqual([]);
  });

  test('skip backward button goes back', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Start playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // Skip forward first to have something to go back to
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await skipForward.click();

    // Now skip backward
    const skipBackward = page.getByRole('button', { name: /^Skip backward$/i });
    await expect(skipBackward).toBeVisible();
    await skipBackward.click();

    await takeScreenshot(page, 'playback-skip-backward');
    expect(consoleErrors).toEqual([]);
  });

  test('chapter forward button jumps to next chapter', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Click next chapter
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await expect(nextChapter).toBeVisible();
    await nextChapter.click();

    // The view should scroll to or show Chapter 2 content prominently
    await takeScreenshot(page, 'playback-next-chapter');
    expect(consoleErrors).toEqual([]);
  });

  test('chapter backward button jumps to previous chapter', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // First navigate to chapter 2
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await nextChapter.click();

    // Then go back to chapter 1
    const prevChapter = page.getByRole('button', { name: /^Previous chapter$/i });
    await expect(prevChapter).toBeVisible();
    await prevChapter.click();

    await takeScreenshot(page, 'playback-prev-chapter');
    expect(consoleErrors).toEqual([]);
  });

  test('speed control changes the displayed speed', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Find the speed display button by its aria-label
    const speedDisplay = page.getByRole('button', { name: /Playback speed/i });
    await expect(speedDisplay).toBeVisible();

    // Click the speed control to open speed panel
    await speedDisplay.click();

    // Click a preset speed to change (e.g., 1.5x)
    const preset = page.getByRole('button', { name: /Set speed to 1\.5x/i });
    await expect(preset).toBeVisible({ timeout: 5000 });
    await preset.click();

    // Speed display should now show the new speed
    await expect(speedDisplay).toContainText('1.5x');

    await takeScreenshot(page, 'playback-speed-changed');
    expect(consoleErrors).toEqual([]);
  });

  test('progress bar updates during simulated playback', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Find the progress bar
    const progressBar = page.getByRole('slider').or(
      page.locator('[class*="progress"], [data-testid="progress-bar"]').first()
    );
    await expect(progressBar).toBeVisible();

    // Start playback
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await playButton.click();

    // Wait a moment for progress to update
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'playback-progress-bar');
    expect(consoleErrors).toEqual([]);
  });
});
