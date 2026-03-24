import { test, expect } from '@playwright/test';
import {
  clearDatabase,
  trackConsoleErrors,
  uploadAndOpenReader,
  mockSpeechSynthesis,
  takeScreenshot,
  focusBody,
} from './helpers';

// Keyboard tests only run on desktop (no keyboard on mobile)
test.describe('Keyboard Interaction Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('space bar toggles play/pause', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await focusBody(page);

    // Press space to play
    await page.keyboard.press('Space');

    // Should switch to pause button (meaning playback started)
    const pauseButton = page.getByRole('button', { name: /^Pause$/i });
    await expect(pauseButton).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, 'keyboard-space-play');

    // Press space again to pause
    await page.keyboard.press('Space');

    // Should switch back to play button
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await expect(playButton).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, 'keyboard-space-pause');
    expect(consoleErrors).toEqual([]);
  });

  test('right arrow triggers skip forward', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await focusBody(page);

    // Start playback first
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // Press right arrow to skip forward
    await page.keyboard.press('ArrowRight');

    await takeScreenshot(page, 'keyboard-right-arrow');
    expect(consoleErrors).toEqual([]);
  });

  test('left arrow triggers skip backward', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await focusBody(page);

    // Start playback
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible({ timeout: 5000 });

    // Skip forward first, then backward
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');

    await takeScreenshot(page, 'keyboard-left-arrow');
    expect(consoleErrors).toEqual([]);
  });

  test('speed up with + key and down with - key', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await focusBody(page);

    // Find current speed display
    const speedDisplay = page.getByRole('button', { name: /Playback speed/i });
    await expect(speedDisplay).toBeVisible();
    const initialSpeed = await speedDisplay.textContent();

    const parseSpeed = (s: string | null) => parseFloat(s?.replace('x', '') ?? '1');

    // Press + to speed up
    await page.keyboard.press('+');

    // Wait for speed to change, then read new speed
    await expect(speedDisplay).not.toHaveText(initialSpeed!, { timeout: 3000 });
    const newSpeed = await speedDisplay.textContent();
    expect(parseSpeed(newSpeed)).toBeGreaterThan(parseSpeed(initialSpeed));

    await takeScreenshot(page, 'keyboard-speed-up');

    // Press - to slow down
    await page.keyboard.press('-');

    await expect(speedDisplay).not.toHaveText(newSpeed!, { timeout: 3000 });
    const downSpeed = await speedDisplay.textContent();
    expect(parseSpeed(downSpeed)).toBeLessThan(parseSpeed(newSpeed));

    await takeScreenshot(page, 'keyboard-speed-down');
    expect(consoleErrors).toEqual([]);
  });

  test('up arrow speeds up and down arrow slows down', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await focusBody(page);

    const speedDisplay = page.getByRole('button', { name: /Playback speed/i });
    await expect(speedDisplay).toBeVisible();
    const initialSpeed = await speedDisplay.textContent();

    const parseSpeed = (s: string | null) => parseFloat(s?.replace('x', '') ?? '1');

    // Up arrow to speed up
    await page.keyboard.press('ArrowUp');

    await expect(speedDisplay).not.toHaveText(initialSpeed!, { timeout: 3000 });
    const speedAfterUp = await speedDisplay.textContent();
    expect(parseSpeed(speedAfterUp)).toBeGreaterThan(parseSpeed(initialSpeed));

    // Down arrow to slow down
    await page.keyboard.press('ArrowDown');

    await expect(speedDisplay).not.toHaveText(speedAfterUp!, { timeout: 3000 });
    const speedAfterDown = await speedDisplay.textContent();
    expect(parseSpeed(speedAfterDown)).toBeLessThan(parseSpeed(speedAfterUp));

    await takeScreenshot(page, 'keyboard-arrow-speed');
    expect(consoleErrors).toEqual([]);
  });

  test('escape navigates back to library', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);
    await focusBody(page);

    // Press Escape to go back
    await page.keyboard.press('Escape');

    // Should navigate back to library
    await page.waitForURL(/^\/$|\/$/, { timeout: 5000 });

    await takeScreenshot(page, 'keyboard-escape-back');
    expect(consoleErrors).toEqual([]);
  });
});
