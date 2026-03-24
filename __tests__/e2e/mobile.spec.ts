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

// Only run these tests on mobile-chrome project
test.describe('Mobile Viewport Tests', () => {
  // These tests target the mobile-chrome project via Playwright config filtering.
  // On desktop projects, the test.describe block will still run but tests verify mobile behavior.

  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('all controls visible on mobile viewport', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Play button
    const playButton = page.getByRole('button', { name: /^Play$/i });
    await expect(playButton).toBeVisible();
    await expect(playButton).toBeInViewport();

    // Skip forward
    const skipForward = page.getByRole('button', { name: /^Skip forward$/i });
    await expect(skipForward).toBeVisible();

    // Skip backward
    const skipBackward = page.getByRole('button', { name: /^Skip backward$/i });
    await expect(skipBackward).toBeVisible();

    await takeScreenshot(page, 'mobile-controls-visible');
    expect(consoleErrors).toEqual([]);
  });

  test('touch targets meet minimum size of 44px', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Check all buttons in the player controls
    const buttons = page.locator(
      '[class*="player"] button, [class*="controls"] button, [data-testid="player-controls"] button'
    );
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          // Touch targets should be at least 44x44 pixels
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    }

    // Also check the main play button specifically
    const playButton = page.getByRole('button', { name: /^Play$/i });
    const playBox = await playButton.boundingBox();
    expect(playBox).toBeTruthy();
    if (playBox) {
      expect(playBox.width).toBeGreaterThanOrEqual(44);
      expect(playBox.height).toBeGreaterThanOrEqual(44);
    }

    await takeScreenshot(page, 'mobile-touch-targets');
    expect(consoleErrors).toEqual([]);
  });

  test('upload zone works on mobile', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Upload zone should be visible
    const uploadZone = page.locator(
      '[class*="upload"], [class*="drop"], [data-testid="upload-zone"]'
    ).first();
    await expect(uploadZone).toBeVisible();

    // Upload a file
    await uploadFileViaInput(page);

    // Card should appear
    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, 'mobile-upload');
    expect(consoleErrors).toEqual([]);
  });

  test('player controls do not overflow the screen', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    const viewportWidth = page.viewportSize()?.width ?? 393; // Pixel 5 width

    // Check that the player controls bar does not overflow
    const playerBar = page.locator(
      '[class*="player"], [class*="controls"], [data-testid="player-controls"]'
    ).first();
    await expect(playerBar).toBeVisible();

    const box = await playerBar.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      // The player bar should not extend beyond the viewport width
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 1); // +1 for rounding
    }

    // Check no horizontal scrollbar exists
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await takeScreenshot(page, 'mobile-no-overflow');
    expect(consoleErrors).toEqual([]);
  });

  test('text is readable on small screens', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Find text content in the reader
    const textContent = page.locator(
      '[class*="content"], [class*="text"], [data-testid="reader-content"]'
    ).first();
    await expect(textContent).toBeVisible();

    // Check font size is at least 14px (readable on mobile)
    const fontSize = await textContent.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(fontSize).toBeGreaterThanOrEqual(14);

    await takeScreenshot(page, 'mobile-text-readable');
    expect(consoleErrors).toEqual([]);
  });

  test('screenshots of mobile layout', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    // Library page on mobile
    await goToLibrary(page);
    await takeScreenshot(page, 'mobile-library-layout');

    // Upload a file
    await uploadFileViaInput(page);
    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await takeScreenshot(page, 'mobile-library-with-card');

    // Reader page on mobile
    await card.click();
    await page.waitForURL(/\/reader\//);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'mobile-reader-layout');

    expect(consoleErrors).toEqual([]);
  });
});
