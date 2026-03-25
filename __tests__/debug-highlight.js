const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIXTURE = path.join(__dirname, 'fixtures', 'sample.txt');

async function getHighlight(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-active="true"]');
    if (!el) return { index: null, text: null, count: 0 };
    const all = document.querySelectorAll('[data-active="true"]');
    return {
      index: parseInt(el.getAttribute('data-word-index') || '-1', 10),
      text: el.textContent?.trim() || null,
      count: all.length,
    };
  });
}

async function getPlayState(page) {
  return page.evaluate(() => {
    // Check if pause button exists (means playing)
    const pauseBtn = document.querySelector('[aria-label="Pause"]');
    const playBtn = document.querySelector('[aria-label="Play"]');
    if (pauseBtn) return 'playing';
    if (playBtn) return 'idle/paused';
    return 'unknown';
  });
}

async function getWordCount(page) {
  return page.evaluate(() => document.querySelectorAll('[data-word-index]').length);
}

(async () => {
  const browser = await chromium.launch({ headless: false }); // headed so we can see
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('\n=== HIGHLIGHT DIAGNOSTIC TEST ===\n');

  // Setup: clear DB, upload file, open reader
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => new Promise(r => {
    const req = indexedDB.deleteDatabase('teresa-tts');
    req.onsuccess = r; req.onerror = r;
  }));
  await page.reload();
  await page.waitForLoadState('networkidle');

  const browseBtn = page.getByRole('button', { name: 'Browse files', exact: true });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), browseBtn.click()]);
  await fc.setFiles(FIXTURE);
  await page.waitForSelector('[data-testid="document-card"]', { timeout: 10000 });
  await page.locator('[data-testid="document-card"]').first().click();
  await page.waitForSelector('[data-word-index]', { timeout: 10000 });
  await page.waitForTimeout(1000);

  const wordCount = await getWordCount(page);
  console.log(`Words rendered: ${wordCount}`);

  // TEST 1: Initial highlight
  let h = await getHighlight(page);
  console.log(`\n[1] INITIAL LOAD`);
  console.log(`   Highlight: index=${h.index}, text="${h.text}", count=${h.count}`);
  console.log(`   ${h.index !== null ? 'PASS' : 'FAIL'} — should have initial highlight`);

  // TEST 2: Press Play
  console.log(`\n[2] PRESS PLAY`);
  const playBtn = page.getByRole('button', { name: /^Play$/i });
  await playBtn.click();
  await page.waitForTimeout(300);
  let state = await getPlayState(page);
  console.log(`   Play state: ${state}`);

  // Wait up to 3 seconds for highlight to move
  const startH = await getHighlight(page);
  console.log(`   Highlight after play click: index=${startH.index}, text="${startH.text}"`);

  let moved = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(100);
    const curr = await getHighlight(page);
    if (curr.index !== null && curr.index !== startH.index) {
      console.log(`   Highlight moved to: index=${curr.index}, text="${curr.text}" (after ${(i+1)*100}ms)`);
      moved = true;
      break;
    }
  }
  console.log(`   ${moved ? 'PASS' : 'FAIL'} — highlight should advance during playback`);

  // TEST 3: Pause
  console.log(`\n[3] PRESS PAUSE`);
  const pauseBtn = page.getByRole('button', { name: /^Pause$/i });
  if (await pauseBtn.isVisible()) {
    const beforePause = await getHighlight(page);
    await pauseBtn.click();
    await page.waitForTimeout(500);
    const afterPause = await getHighlight(page);
    console.log(`   Before pause: index=${beforePause.index}`);
    console.log(`   After pause:  index=${afterPause.index}`);
    console.log(`   ${afterPause.index === beforePause.index ? 'PASS' : 'FAIL'} — position should be preserved`);
  } else {
    console.log(`   FAIL — Pause button not found (playback didn't start?)`);
    // Try to check what buttons exist
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button[aria-label]')).map(b => b.getAttribute('aria-label'));
    });
    console.log(`   Available buttons: ${buttons.join(', ')}`);
  }

  // TEST 4: Resume (Play again)
  console.log(`\n[4] PRESS PLAY (RESUME)`);
  const beforeResume = await getHighlight(page);
  const playBtn2 = page.getByRole('button', { name: /^Play$/i });
  if (await playBtn2.isVisible()) {
    await playBtn2.click();
    await page.waitForTimeout(2000);
    const afterResume = await getHighlight(page);
    console.log(`   Before resume: index=${beforeResume.index}`);
    console.log(`   After resume:  index=${afterResume.index}`);
    console.log(`   ${afterResume.index >= beforeResume.index ? 'PASS' : 'FAIL'} — should continue from paused position`);

    // Pause again for next tests
    const pauseBtn2 = page.getByRole('button', { name: /^Pause$/i });
    if (await pauseBtn2.isVisible()) await pauseBtn2.click();
    await page.waitForTimeout(300);
  } else {
    console.log(`   FAIL — Play button not visible`);
  }

  // TEST 5: Skip Forward
  console.log(`\n[5] SKIP FORWARD`);
  const beforeSkipF = await getHighlight(page);
  const skipFBtn = page.getByRole('button', { name: /^Skip forward$/i });
  await skipFBtn.click();
  await page.waitForTimeout(500);
  const afterSkipF = await getHighlight(page);
  console.log(`   Before: index=${beforeSkipF.index}`);
  console.log(`   After:  index=${afterSkipF.index}`);
  console.log(`   ${afterSkipF.index > beforeSkipF.index ? 'PASS' : 'FAIL'} — should jump forward`);

  // TEST 6: Skip Backward
  console.log(`\n[6] SKIP BACKWARD`);
  const beforeSkipB = await getHighlight(page);
  const skipBBtn = page.getByRole('button', { name: /^Skip backward$/i });
  await skipBBtn.click();
  await page.waitForTimeout(500);
  const afterSkipB = await getHighlight(page);
  console.log(`   Before: index=${beforeSkipB.index}`);
  console.log(`   After:  index=${afterSkipB.index}`);
  console.log(`   ${afterSkipB.index < beforeSkipB.index ? 'PASS' : 'FAIL'} — should jump backward`);

  // TEST 7: Next Chapter
  console.log(`\n[7] NEXT CHAPTER`);
  const beforeNextCh = await getHighlight(page);
  const nextChBtn = page.getByRole('button', { name: /^Next chapter$/i });
  await nextChBtn.click();
  await page.waitForTimeout(1000);
  const afterNextCh = await getHighlight(page);
  const chHeading = await page.evaluate(() => {
    const h2 = document.querySelector('h2');
    return h2?.textContent || 'none';
  });
  console.log(`   Before: index=${beforeNextCh.index}`);
  console.log(`   After:  index=${afterNextCh.index}`);
  console.log(`   Chapter heading: "${chHeading}"`);
  console.log(`   ${afterNextCh.index > beforeNextCh.index && chHeading.includes('2') ? 'PASS' : 'FAIL'} — should be in chapter 2`);

  // TEST 8: Previous Chapter
  console.log(`\n[8] PREVIOUS CHAPTER`);
  const prevChBtn = page.getByRole('button', { name: /^Previous chapter$/i });
  await prevChBtn.click();
  await page.waitForTimeout(1000);
  const afterPrevCh = await getHighlight(page);
  const chHeading2 = await page.evaluate(() => {
    const h2 = document.querySelector('h2');
    return h2?.textContent || 'none';
  });
  console.log(`   After:  index=${afterPrevCh.index}`);
  console.log(`   Chapter heading: "${chHeading2}"`);
  console.log(`   ${chHeading2.includes('1') ? 'PASS' : 'FAIL'} — should be back in chapter 1`);

  // TEST 9: Click on a word
  console.log(`\n[9] CLICK ON WORD`);
  const targetWord = page.locator('[data-word-index]').nth(10);
  const targetIdx = await targetWord.getAttribute('data-word-index');
  await targetWord.click();
  await page.waitForTimeout(500);
  const afterClick = await getHighlight(page);
  console.log(`   Clicked word index: ${targetIdx}`);
  console.log(`   Highlight index:    ${afterClick.index}`);
  console.log(`   ${String(afterClick.index) === targetIdx ? 'PASS' : 'FAIL'} — clicked word should be highlighted`);

  // TEST 10: Multiple highlights check
  console.log(`\n[10] SINGLE HIGHLIGHT CHECK`);
  const multiCheck = await getHighlight(page);
  console.log(`   Highlight count: ${multiCheck.count}`);
  console.log(`   ${multiCheck.count <= 1 ? 'PASS' : 'FAIL'} — should have 0 or 1 highlight`);

  // SUMMARY
  console.log(`\n=== CONSOLE ERRORS ===`);
  if (errors.length === 0) {
    console.log('None');
  } else {
    errors.forEach(e => console.log(`  ${e}`));
  }

  // Take final screenshot
  const ssDir = path.join(__dirname, '..', 'test-results', 'debug');
  fs.mkdirSync(ssDir, { recursive: true });
  await page.screenshot({ path: path.join(ssDir, 'final-state.png') });

  await browser.close();
  console.log('\nDone.');
})();
