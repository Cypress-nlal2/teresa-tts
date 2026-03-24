import { test, expect } from '@playwright/test';
import {
  clearDatabase,
  trackConsoleErrors,
  goToLibrary,
  uploadFileViaInput,
  takeScreenshot,
  SAMPLE_TXT_PATH,
} from './helpers';

test.describe('Library Page', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
  });

  test('app loads and shows branding', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // The app title should contain "Teresa TTS" with a heart
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('Teresa TTS');

    await takeScreenshot(page, 'library-branding');
    expect(consoleErrors).toEqual([]);
  });

  test('empty state is shown when no documents exist', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Should show some empty state message when no docs are uploaded
    const emptyState = page.getByText(/no document|empty|upload.*to get started|nothing here/i).first();
    await expect(emptyState).toBeVisible();

    await takeScreenshot(page, 'library-empty-state');
    expect(consoleErrors).toEqual([]);
  });

  test('upload zone is visible with format hints', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Upload zone should be visible
    const uploadZone = page.locator(
      '[class*="upload"], [class*="drop"], [data-testid="upload-zone"], [class*="Upload"], [class*="Drop"]'
    ).first();
    await expect(uploadZone).toBeVisible();

    // Should mention accepted formats
    const formatHint = page.getByText(/pdf|docx|txt|epub/i).first();
    await expect(formatHint).toBeVisible();

    await takeScreenshot(page, 'library-upload-zone');
    expect(consoleErrors).toEqual([]);
  });

  test('can upload a TXT file via file chooser', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);
    await uploadFileViaInput(page);

    // After upload, a document card should appear
    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, 'library-after-upload');
    expect(consoleErrors).toEqual([]);
  });

  test('after upload, document card appears with correct metadata', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);
    await uploadFileViaInput(page);

    // Wait for the card
    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    // Card should show the filename or document title
    await expect(card).toContainText(/sample/i);

    // Card should show file size
    const sizeText = card.getByText(/bytes|kb|mb/i);
    await expect(sizeText).toBeVisible();

    await takeScreenshot(page, 'library-card-metadata');
    expect(consoleErrors).toEqual([]);
  });

  test('document card shows format badge and chapter count', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);
    await uploadFileViaInput(page);

    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    // Should show TXT format badge
    const formatBadge = card.getByText(/txt/i);
    await expect(formatBadge).toBeVisible();

    // Should show chapter count (3 chapters in sample.txt)
    const chapterCount = card.getByText(/3.*chapter|chapter.*3/i);
    await expect(chapterCount).toBeVisible();

    await takeScreenshot(page, 'library-card-format-chapters');
    expect(consoleErrors).toEqual([]);
  });

  test('can delete a document with confirmation', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);
    await uploadFileViaInput(page);

    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    // Find and click the delete button on the card
    const deleteButton = card.getByRole('button', { name: /delete|remove/i });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // A confirmation dialog should appear
    const confirmDialog = page.getByRole('dialog').or(page.getByRole('alertdialog')).or(
      page.locator('[class*="confirm"], [class*="dialog"], [class*="modal"]').first()
    );
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Confirm the deletion — target the button inside the confirmation dialog
    const confirmButton = confirmDialog.getByRole('button', { name: /confirm|yes|delete|ok/i }).first();
    await confirmButton.click();

    // Card should be gone
    await expect(card).not.toBeVisible({ timeout: 5000 });

    // Empty state should reappear
    const emptyState = page.getByText(/no document|empty|upload.*to get started|nothing here/i).first();
    await expect(emptyState).toBeVisible();

    await takeScreenshot(page, 'library-after-delete');
    expect(consoleErrors).toEqual([]);
  });

  test('library persists across page reloads', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);
    await uploadFileViaInput(page);

    const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(card).toBeVisible({ timeout: 10000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Card should still be there
    const cardAfterReload = page.locator('[class*="card"], [data-testid="document-card"]').first();
    await expect(cardAfterReload).toBeVisible({ timeout: 10000 });
    await expect(cardAfterReload).toContainText(/sample/i);

    await takeScreenshot(page, 'library-after-reload');
    expect(consoleErrors).toEqual([]);
  });
});
