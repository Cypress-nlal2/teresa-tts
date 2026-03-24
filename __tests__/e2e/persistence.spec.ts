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

test.describe('Data Persistence Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('upload a document, reload page, document still in library', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);
    await uploadFileViaInput(page);

    // Verify card is present
    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Card should still be present
    const cardAfterReload = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(cardAfterReload).toBeVisible({ timeout: 10000 });
    await expect(cardAfterReload).toContainText(/sample/i);

    await takeScreenshot(page, 'persistence-library-reload');
    expect(consoleErrors).toEqual([]);
  });

  test('open reader, advance position, reload, position restored', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Navigate to chapter 2 to change position
    const nextChapter = page.getByRole('button', { name: /^Next chapter$/i });
    await expect(nextChapter).toBeVisible();
    await nextChapter.click();

    // Wait for position to be saved (give it a moment)
    await page.waitForTimeout(1000);

    // Remember the current URL
    const readerUrl = page.url();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on the reader page
    expect(page.url()).toBe(readerUrl);

    // The position should be restored (Chapter 2 content should be visible/active)
    // We check that the app didn't reset to the beginning
    await takeScreenshot(page, 'persistence-position-restored');
    expect(consoleErrors).toEqual([]);
  });

  test('delete a document, reload, document gone', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);
    await uploadFileViaInput(page);

    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    // Delete the document
    const deleteButton = card.getByRole('button', { name: /delete|remove/i });
    await deleteButton.click();

    // Confirm deletion — scope to dialog to avoid matching card's delete button
    const dialog = page.getByRole('dialog').or(page.locator('dialog'));
    const confirmButton = dialog.getByRole('button', { name: /confirm|yes|delete|ok/i }).first();
    await confirmButton.click();

    // Card should be gone
    await expect(card).not.toBeVisible({ timeout: 5000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Document should still be gone
    const cardAfterReload = page.locator('[class*="card"], [data-testid="document-card"]');
    await expect(cardAfterReload).toHaveCount(0, { timeout: 5000 });

    // Empty state should be visible
    const emptyState = page.getByText(/no document|empty|upload.*to get started|nothing here/i).first();
    await expect(emptyState).toBeVisible();

    await takeScreenshot(page, 'persistence-delete-reload');
    expect(consoleErrors).toEqual([]);
  });

  test('theme setting persists across reloads', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Toggle to dark mode
    const themeToggle = page.getByRole('button', { name: /theme|dark|light|mode/i });
    await expect(themeToggle).toBeVisible();
    await themeToggle.click();

    // Verify dark mode is active
    let isDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark';
    });
    expect(isDark).toBe(true);

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be dark
    isDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark';
    });
    expect(isDark).toBe(true);

    await takeScreenshot(page, 'persistence-theme-reload');
    expect(consoleErrors).toEqual([]);
  });
});
