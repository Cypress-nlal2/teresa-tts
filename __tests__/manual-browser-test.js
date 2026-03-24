const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotDir = path.join(__dirname, '..', 'test-results', 'manual-test');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const consoleErrors = [];
  const consoleWarnings = [];
  let stepNum = 0;

  function stepName(name) {
    stepNum++;
    return `${String(stepNum).padStart(2, '0')}-${name}`;
  }

  async function screenshot(page, name) {
    const fileName = `${stepName(name)}.png`;
    await page.screenshot({ path: path.join(screenshotDir, fileName), fullPage: false });
    console.log(`  Screenshot: ${fileName}`);
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[console.error] ${msg.text()}`);
    }
    if (msg.type() === 'warning') {
      consoleWarnings.push(`[console.warn] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });

  try {
    // ===== 1. Library Page =====
    console.log('\n=== 1. Library Page ===');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, 'empty-library');

    // Verify branding
    const branding = await page.textContent('header');
    if (branding && branding.includes('Teresa TTS')) {
      console.log('  OK: "Teresa TTS" branding is visible');
    } else {
      console.log('  FAIL: "Teresa TTS" branding NOT found');
    }

    // Verify upload zone
    const uploadZone = await page.$('[data-testid="upload-zone"]');
    if (uploadZone) {
      console.log('  OK: Upload zone is visible');
    } else {
      console.log('  FAIL: Upload zone NOT found');
    }

    // Verify empty state
    const emptyStateText = await page.textContent('body');
    if (emptyStateText && emptyStateText.includes('Your library is empty')) {
      console.log('  OK: Empty state message visible');
    } else {
      console.log('  FAIL: Empty state message NOT found');
    }

    // ===== 2. Theme Toggle =====
    console.log('\n=== 2. Theme Toggle ===');

    // The theme toggle button has aria-label starting with "Switch to"
    const themeBtn = page.locator('button[aria-label^="Switch to"]');
    await themeBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, 'dark-mode');

    // Get current theme from html element
    let htmlClass = await page.$eval('html', (el) => el.className);
    console.log(`  HTML class after first toggle: "${htmlClass}"`);

    await themeBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, 'after-second-toggle');

    htmlClass = await page.$eval('html', (el) => el.className);
    console.log(`  HTML class after second toggle: "${htmlClass}"`);

    // ===== 3. Upload TXT File =====
    console.log('\n=== 3. Upload TXT File ===');

    const samplePath = path.resolve(__dirname, 'fixtures', 'sample.txt');
    console.log(`  Uploading: ${samplePath}`);

    // Use file chooser
    const fileInput = page.locator('[data-testid="upload-zone"] input[type="file"]');
    await fileInput.setInputFiles(samplePath);

    // Wait for parsing to complete and document card to appear
    await page.waitForSelector('[data-testid="document-card"]', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await screenshot(page, 'library-with-document');

    // Verify card contents
    const cardText = await page.$eval('[data-testid="document-card"]', (el) => el.textContent);
    console.log(`  Card text: "${cardText}"`);

    if (cardText && cardText.includes('sample')) {
      console.log('  OK: Card shows title');
    }
    if (cardText && cardText.includes('txt')) {
      console.log('  OK: Card shows format badge (txt)');
    }
    if (cardText && cardText.includes('chapter')) {
      console.log('  OK: Card shows chapter count');
    }

    // ===== 4. Open Reader =====
    console.log('\n=== 4. Open Reader ===');
    await page.click('[data-testid="document-card"]');

    // Wait for reader to load - wait for player controls
    await page.waitForSelector('[data-testid="player-controls"]', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await screenshot(page, 'reader-view');

    // Verify chapter heading
    const readerText = await page.textContent('body');
    if (readerText && readerText.includes('Chapter 1')) {
      console.log('  OK: "Chapter 1" heading visible');
    } else {
      console.log('  FAIL: "Chapter 1" heading NOT found');
    }

    // Verify words are rendered
    const wordButtons = await page.$$('button.word');
    console.log(`  Word buttons found: ${wordButtons.length}`);
    if (wordButtons.length > 0) {
      console.log('  OK: Text words are rendered');
    } else {
      console.log('  FAIL: No word buttons found');
    }

    // Verify player controls
    const playerControls = await page.$('[data-testid="player-controls"]');
    if (playerControls) {
      console.log('  OK: Player controls are visible');
    } else {
      console.log('  FAIL: Player controls NOT found');
    }

    // ===== 5. Play/Pause =====
    console.log('\n=== 5. Play/Pause ===');

    const playBtn = page.locator('button[aria-label="Play"]');
    await playBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'playing-state');

    // Check if pause button now visible
    const pauseBtn = page.locator('button[aria-label="Pause"]');
    const pauseVisible = await pauseBtn.isVisible().catch(() => false);
    if (pauseVisible) {
      console.log('  OK: Pause button visible during playback');
    } else {
      console.log('  NOTE: Pause button not visible (TTS may not be available in headless)');
    }

    // Try to pause
    if (pauseVisible) {
      await pauseBtn.click();
    } else {
      // If still showing Play, click it again to toggle
      const playStillVisible = await playBtn.isVisible().catch(() => false);
      if (playStillVisible) {
        console.log('  Clicking Play button (TTS may not have started)');
      }
    }
    await page.waitForTimeout(500);
    await screenshot(page, 'paused-state');

    // ===== 6. Skip Forward/Backward =====
    console.log('\n=== 6. Skip Forward/Backward ===');

    const skipFwdBtn = page.locator('button[aria-label="Skip forward"]');
    await skipFwdBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, 'after-skip-forward');

    const skipBwdBtn = page.locator('button[aria-label="Skip backward"]');
    await skipBwdBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, 'after-skip-backward');

    // ===== 7. Chapter Navigation =====
    console.log('\n=== 7. Chapter Navigation ===');

    const nextChapterBtn = page.locator('button[aria-label="Next chapter"]');
    await nextChapterBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'chapter-2');

    const ch2Text = await page.textContent('body');
    if (ch2Text && ch2Text.includes('Chapter 2')) {
      console.log('  OK: Chapter 2 content visible');
    } else {
      console.log('  FAIL: Chapter 2 content NOT found');
    }

    const prevChapterBtn = page.locator('button[aria-label="Previous chapter"]');
    await prevChapterBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, 'back-to-chapter-1');

    const ch1Text = await page.textContent('body');
    if (ch1Text && ch1Text.includes('Chapter 1')) {
      console.log('  OK: Back to Chapter 1');
    }

    // ===== 8. Speed Control =====
    console.log('\n=== 8. Speed Control ===');

    // Click speed display button in info row (shows "1.0x")
    const speedBtn = page.locator('button[aria-label="Adjust speed"]');
    await speedBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, 'speed-control-open');

    // Click 1.5x preset
    const preset15 = page.locator('button[aria-label="Set speed to 1.5x"]');
    const preset15Visible = await preset15.isVisible().catch(() => false);
    if (preset15Visible) {
      await preset15.click();
      await page.waitForTimeout(500);
      console.log('  OK: Clicked 1.5x speed preset');
    } else {
      console.log('  NOTE: 1.5x preset not visible, trying other selector');
      // Try clicking the speed button in the info row instead
      const speedInfoBtn = page.locator('button[aria-label*="Playback speed"]');
      await speedInfoBtn.click();
      await page.waitForTimeout(500);
      const preset15alt = page.locator('button[aria-label="Set speed to 1.5x"]');
      if (await preset15alt.isVisible().catch(() => false)) {
        await preset15alt.click();
        await page.waitForTimeout(500);
      }
    }
    await screenshot(page, 'speed-changed');

    // Close speed control if still open
    const closeSpeedBtn = page.locator('button[aria-label="Close speed control"]');
    if (await closeSpeedBtn.isVisible().catch(() => false)) {
      await closeSpeedBtn.click();
      await page.waitForTimeout(300);
    }

    // ===== 9. Word Click (Seek) =====
    console.log('\n=== 9. Word Click (Seek) ===');

    const wordBtns = await page.$$('button.word');
    if (wordBtns.length > 10) {
      await wordBtns[10].click();
      await page.waitForTimeout(500);
      console.log('  OK: Clicked on word at index 10');
    } else if (wordBtns.length > 0) {
      await wordBtns[0].click();
      await page.waitForTimeout(500);
      console.log('  OK: Clicked on first word');
    }
    await screenshot(page, 'after-word-click');

    // ===== 10. Back to Library =====
    console.log('\n=== 10. Back to Library ===');

    const backBtn = page.locator('button[aria-label="Go back"]');
    await backBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'back-in-library');

    // Verify document card exists
    const cardAfterBack = await page.$('[data-testid="document-card"]');
    if (cardAfterBack) {
      console.log('  OK: Document card still exists after going back');
    } else {
      console.log('  FAIL: Document card NOT found after going back');
    }

    // ===== 11. Persistence Check =====
    console.log('\n=== 11. Persistence Check ===');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'after-reload');

    const cardAfterReload = await page.$('[data-testid="document-card"]');
    if (cardAfterReload) {
      console.log('  OK: Document persisted after reload');
    } else {
      console.log('  FAIL: Document NOT found after reload');
    }

    // ===== 12. Delete Document =====
    console.log('\n=== 12. Delete Document ===');

    // The delete button is hidden by default (opacity-0 group-hover:opacity-100)
    // We need to force it visible or use JS click
    const card = await page.$('[data-testid="document-card"]');
    if (card) {
      // Hover over the card to reveal delete button
      await card.hover();
      await page.waitForTimeout(500);

      const deleteBtn = page.locator('button[aria-label^="Delete"]');
      // Force click even if opacity is 0
      await deleteBtn.click({ force: true });
      await page.waitForTimeout(500);
      await screenshot(page, 'confirm-dialog');

      // Check for confirm dialog
      const dialogVisible = await page.locator('dialog[open]').isVisible().catch(() => false);
      if (dialogVisible) {
        console.log('  OK: Confirmation dialog visible');
      } else {
        console.log('  NOTE: Dialog may not be visible via standard check');
      }

      // Click the Delete confirm button
      const confirmBtn = page.locator('dialog button:has-text("Delete")');
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      } else {
        // Try alternate approach - look for button with danger styling
        const allDialogBtns = await page.$$('dialog button');
        for (const btn of allDialogBtns) {
          const text = await btn.textContent();
          if (text && text.trim() === 'Delete') {
            await btn.click();
            break;
          }
        }
      }

      await page.waitForTimeout(1000);
      await screenshot(page, 'empty-library-after-delete');

      // Verify library is empty again
      const emptyAgain = await page.textContent('body');
      if (emptyAgain && emptyAgain.includes('Your library is empty')) {
        console.log('  OK: Library is empty after deletion');
      } else {
        console.log('  FAIL: Library not showing empty state after deletion');
      }
    }

    // ===== 13. Console Error Check =====
    console.log('\n=== 13. Console Errors ===');
    if (consoleErrors.length === 0) {
      console.log('  No console errors detected!');
    } else {
      console.log(`  ${consoleErrors.length} console error(s):`);
      consoleErrors.forEach((e) => console.log(`    ${e}`));
    }

    if (consoleWarnings.length > 0) {
      console.log(`\n  ${consoleWarnings.length} console warning(s):`);
      consoleWarnings.forEach((w) => console.log(`    ${w}`));
    }

    console.log('\n=== Test Complete ===');

  } catch (err) {
    console.error('TEST ERROR:', err.message);
    await screenshot(page, 'error-state').catch(() => {});
  } finally {
    await browser.close();
  }
})();
