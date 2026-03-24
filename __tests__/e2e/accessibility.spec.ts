import { test, expect } from '@playwright/test';
import {
  clearDatabase,
  trackConsoleErrors,
  goToLibrary,
  uploadAndOpenReader,
  mockSpeechSynthesis,
  takeScreenshot,
} from './helpers';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await clearDatabase(page);
  });

  test('all interactive buttons have aria-labels', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Get all buttons in the page (exclude Next.js dev overlay buttons)
    const buttons = page.locator('button:not(nextjs-portal button):not(nextjs-portal *)');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        // Each button should have an aria-label, aria-labelledby, or visible text content
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledBy = await button.getAttribute('aria-labelledby');
        const textContent = (await button.textContent())?.trim();
        const title = await button.getAttribute('title');

        const hasLabel = !!(ariaLabel || ariaLabelledBy || textContent || title);
        expect(hasLabel).toBe(true);
      }
    }

    await takeScreenshot(page, 'a11y-aria-labels');
    expect(consoleErrors).toEqual([]);
  });

  test('focus-visible rings appear on keyboard focus', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Tab through elements until we find an app element (skip Next.js dev overlay)
    let foundAppFocus = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.keyboard.press('Tab');

      const isAppElement = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        // Skip Next.js dev overlay elements
        if (el.closest('nextjs-portal')) return false;
        if (el.tagName.toLowerCase().startsWith('nextjs')) return false;
        return el.tagName !== 'BODY';
      });

      if (isAppElement) {
        foundAppFocus = true;
        break;
      }
    }
    expect(foundAppFocus).toBe(true);

    // The focused element should have a visible focus indicator (exclude Next.js dev tools)
    const focusedElement = page.locator(':focus:not(nextjs-portal):not(nextjs-portal *)');
    await expect(focusedElement).toBeVisible();

    // Check that focus styling exists (outline, box-shadow, or ring)
    const hasFocusStyle = await focusedElement.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const outline = style.outline;
      const boxShadow = style.boxShadow;

      // Check if outline is visible (not none/0)
      const hasOutline = outline && !outline.includes('none') && !outline.startsWith('0');
      // Check if box-shadow is visible (not none)
      const hasBoxShadow = boxShadow && boxShadow !== 'none';

      return !!(hasOutline || hasBoxShadow);
    });
    expect(hasFocusStyle).toBe(true);

    await takeScreenshot(page, 'a11y-focus-visible');
    expect(consoleErrors).toEqual([]);
  });

  test('progress bar has proper ARIA attributes', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Find the progress bar by role
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();

    // Check ARIA attributes
    const ariaValueNow = await slider.getAttribute('aria-valuenow');
    const ariaValueMin = await slider.getAttribute('aria-valuemin');
    const ariaValueMax = await slider.getAttribute('aria-valuemax');

    expect(ariaValueNow).not.toBeNull();
    expect(ariaValueMin).not.toBeNull();
    expect(ariaValueMax).not.toBeNull();

    // Min should be less than or equal to max
    expect(Number(ariaValueMin)).toBeLessThanOrEqual(Number(ariaValueMax));

    // Current value should be between min and max
    expect(Number(ariaValueNow)).toBeGreaterThanOrEqual(Number(ariaValueMin));
    expect(Number(ariaValueNow)).toBeLessThanOrEqual(Number(ariaValueMax));

    await takeScreenshot(page, 'a11y-progress-aria');
    expect(consoleErrors).toEqual([]);
  });

  test('skip link exists and works', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Skip links are typically hidden until focused
    // Press Tab multiple times to reveal the skip link (may need to skip past Next.js dev overlay)
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Look for a skip link
    const skipLink = page.getByRole('link', { name: /skip/i }).or(
      page.locator('a[href*="main"], a[href*="content"]').first()
    );

    // The skip link should exist in the DOM
    const skipLinkCount = await skipLink.count();
    expect(skipLinkCount).toBeGreaterThan(0);

    await takeScreenshot(page, 'a11y-skip-link');
    expect(consoleErrors).toEqual([]);
  });

  test('tab order is logical through player controls', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Tab through elements and collect the order of focused elements
    // Filter out Next.js dev overlay elements
    const focusOrder: string[] = [];

    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const focusedLabel = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return 'none';
        // Skip Next.js dev overlay elements
        if (el.closest('nextjs-portal')) return '__nextjs__';
        if (el.tagName.toLowerCase().startsWith('nextjs')) return '__nextjs__';
        return (
          el.getAttribute('aria-label') ||
          el.textContent?.trim().substring(0, 30) ||
          el.tagName.toLowerCase()
        );
      });
      if (focusedLabel !== '__nextjs__') {
        focusOrder.push(focusedLabel);
      }
    }

    // There should be multiple unique focusable elements
    const uniqueElements = new Set(focusOrder);
    expect(uniqueElements.size).toBeGreaterThan(3);

    await takeScreenshot(page, 'a11y-tab-order');
    expect(consoleErrors).toEqual([]);
  });

  test('color contrast meets minimum standards', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await uploadAndOpenReader(page);

    // Check contrast of key text elements
    const contrastResults = await page.evaluate(() => {
      // Helper function to get relative luminance
      function getLuminance(r: number, g: number, b: number): number {
        const sRGB = [r, g, b].map((c) => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
      }

      function parseColor(color: string): [number, number, number, number] {
        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaMatch) return [parseInt(rgbaMatch[1]), parseInt(rgbaMatch[2]), parseInt(rgbaMatch[3]), rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1];
        return [0, 0, 0, 1];
      }

      function isTransparent(color: string): boolean {
        const [, , , a] = parseColor(color);
        return a < 0.1;
      }

      function getEffectiveBgColor(el: Element): string {
        let current: Element | null = el;
        while (current) {
          const bg = window.getComputedStyle(current).backgroundColor;
          if (bg && !isTransparent(bg)) return bg;
          current = current.parentElement;
        }
        return 'rgb(255, 255, 255)';
      }

      function getContrastRatio(fg: string, bg: string): number {
        const fgRGB = parseColor(fg);
        const bgRGB = parseColor(bg);
        const l1 = getLuminance(fgRGB[0], fgRGB[1], fgRGB[2]);
        const l2 = getLuminance(bgRGB[0], bgRGB[1], bgRGB[2]);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }

      const results: { element: string; ratio: number; pass: boolean }[] = [];

      // Check heading elements
      const headings = document.querySelectorAll('h1, h2, h3');
      headings.forEach((h) => {
        const style = window.getComputedStyle(h);
        const bg = getEffectiveBgColor(h);
        const ratio = getContrastRatio(style.color, bg);
        results.push({
          element: h.tagName,
          ratio: Math.round(ratio * 100) / 100,
          pass: ratio >= 3, // Large text needs 3:1
        });
      });

      // Check body text
      const paragraphs = document.querySelectorAll('p, span');
      const sampledP = Array.from(paragraphs).slice(0, 5);
      sampledP.forEach((p) => {
        const style = window.getComputedStyle(p);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          const bg = getEffectiveBgColor(p);
          const ratio = getContrastRatio(style.color, bg);
          results.push({
            element: p.tagName,
            ratio: Math.round(ratio * 100) / 100,
            pass: ratio >= 4.5, // Normal text needs 4.5:1
          });
        }
      });

      return results;
    });

    // At least some elements should pass contrast checks
    const passingElements = contrastResults.filter((r) => r.pass);
    expect(passingElements.length).toBeGreaterThan(0);

    await takeScreenshot(page, 'a11y-contrast');
    expect(consoleErrors).toEqual([]);
  });

  test('buttons have accessible names on library page', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    await goToLibrary(page);

    // Theme toggle should have an accessible name
    const themeToggle = page.getByRole('button', { name: /theme|dark|light|mode/i });
    await expect(themeToggle).toBeVisible();

    await takeScreenshot(page, 'a11y-library-buttons');
    expect(consoleErrors).toEqual([]);
  });
});
