import { test, expect } from '@playwright/test';
import {
  clearDatabase,
  trackConsoleErrors,
  goToLibrary,
  takeScreenshot,
} from './helpers';

test.describe('Theme and Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
  });

  test('default theme loads correctly', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Page should load with a visible body and header
    await expect(page.locator('body')).toBeVisible();
    const header = page.locator('header');
    await expect(header).toBeVisible();

    await takeScreenshot(page, 'theme-default');
    expect(consoleErrors).toEqual([]);
  });

  test('clicking theme toggle switches to dark mode', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Find the theme toggle button
    const themeToggle = page.getByRole('button', { name: /theme|dark|light|mode/i });
    await expect(themeToggle).toBeVisible();

    // Click to switch to dark mode
    await themeToggle.click();

    // The page should now have a dark background
    // Check for dark class on html/body or a dark data attribute
    const isDark = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return (
        html.classList.contains('dark') ||
        body.classList.contains('dark') ||
        html.getAttribute('data-theme') === 'dark' ||
        html.style.colorScheme === 'dark'
      );
    });
    expect(isDark).toBe(true);

    await takeScreenshot(page, 'theme-dark-mode');
    expect(consoleErrors).toEqual([]);
  });

  test('dark mode applies dark background', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Toggle to dark mode
    const themeToggle = page.getByRole('button', { name: /theme|dark|light|mode/i });
    await themeToggle.click();

    // Check that background color is dark
    const bgColor = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return style.backgroundColor;
    });

    // Parse the RGB value - dark backgrounds have low RGB values
    const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      // Dark background means all RGB values should be below 128
      expect(Math.max(r, g, b)).toBeLessThan(128);
    }

    await takeScreenshot(page, 'theme-dark-background');
    expect(consoleErrors).toEqual([]);
  });

  test('theme persists after page reload', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Toggle to dark mode
    const themeToggle = page.getByRole('button', { name: /theme|dark|light|mode/i });
    await themeToggle.click();

    // Verify dark mode is active
    let isDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark';
    });
    expect(isDark).toBe(true);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Theme should still be dark
    isDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark';
    });
    expect(isDark).toBe(true);

    await takeScreenshot(page, 'theme-persists-after-reload');
    expect(consoleErrors).toEqual([]);
  });

  test('can cycle through light, dark, and system themes', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    const themeToggle = page.getByRole('button', { name: /theme|dark|light|mode/i });
    await expect(themeToggle).toBeVisible();

    // Click 1: should move to next theme (light -> dark)
    await themeToggle.click();
    await takeScreenshot(page, 'theme-cycle-dark');

    // Click 2: should move to next theme (dark -> system)
    await themeToggle.click();
    await takeScreenshot(page, 'theme-cycle-system');

    // Click 3: should cycle back (system -> light)
    await themeToggle.click();
    await takeScreenshot(page, 'theme-cycle-light');

    expect(consoleErrors).toEqual([]);
  });

  test('screenshots of both light and dark modes', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Screenshot in light mode
    await takeScreenshot(page, 'theme-light-full');

    // Switch to dark mode
    const themeToggle = page.getByRole('button', { name: /theme|dark|light|mode/i });
    await themeToggle.click();

    // Screenshot in dark mode
    await takeScreenshot(page, 'theme-dark-full');

    expect(consoleErrors).toEqual([]);
  });
});
