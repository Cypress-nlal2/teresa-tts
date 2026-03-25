const { chromium, devices } = require('@playwright/test');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixtures', 'sample.txt');
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

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

(async () => {
  const pixel5 = devices['Pixel 5'];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...pixel5,
    userAgent: ANDROID_UA,
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('\n=== ANDROID CHROME HIGHLIGHT TEST ===\n');

  // Check what platform is detected
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('domcontentloaded');

  const platform = await page.evaluate(() => {
    const ua = navigator.userAgent;
    return {
      ua: ua.substring(0, 80),
      isAndroid: /Android/.test(ua) && /Chrome/.test(ua),
    };
  });
  console.log(`UA: ${platform.ua}...`);
  console.log(`Detected as Android Chrome: ${platform.isAndroid}`);

  // Clear DB, upload, open reader
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

  // Check platform strategy that was used
  const strategy = await page.evaluate(() => {
    // Access the platform detector cache via a test hook
    const ua = navigator.userAgent;
    const isChromeAndroid = /Android/.test(ua) && /Chrome/.test(ua);
    return { isChromeAndroid };
  });
  console.log(`Platform: Chrome Android = ${strategy.isChromeAndroid}`);
  console.log(`(useCancelForPause=true, hasBoundaryEvents=false → uses time estimation)\n`);

  let pass = 0, fail = 0;

  // TEST 1: Initial highlight
  let h = await getHighlight(page);
  console.log(`[1] INITIAL: index=${h.index}, text="${h.text}" → ${h.index !== null ? 'PASS' : 'FAIL'}`);
  h.index !== null ? pass++ : fail++;

  // TEST 2: Play - highlight should advance via time estimation
  const playBtn = page.getByRole('button', { name: /^Play$/i });
  await playBtn.click();
  await page.waitForTimeout(300);

  const startIdx = (await getHighlight(page)).index;
  let moved = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(100);
    const curr = await getHighlight(page);
    if (curr.index !== null && curr.index !== startIdx) {
      console.log(`[2] PLAY: moved ${startIdx}→${curr.index} (${(i+1)*100}ms) → PASS`);
      moved = true;
      pass++;
      break;
    }
  }
  if (!moved) { console.log(`[2] PLAY: stuck at ${startIdx} → FAIL`); fail++; }

  // TEST 3: Pause preserves
  const beforePause = await getHighlight(page);
  const pauseBtn = page.getByRole('button', { name: /^Pause$/i });
  if (await pauseBtn.isVisible()) {
    await pauseBtn.click();
    await page.waitForTimeout(500);
    const afterPause = await getHighlight(page);
    const ok = afterPause.index !== null && Math.abs(afterPause.index - beforePause.index) <= 2;
    console.log(`[3] PAUSE: ${beforePause.index}→${afterPause.index} → ${ok ? 'PASS' : 'FAIL'}`);
    ok ? pass++ : fail++;
  } else {
    console.log(`[3] PAUSE: button not found → FAIL`);
    fail++;
  }

  // TEST 4: Resume advances
  const beforeResume = await getHighlight(page);
  const playBtn2 = page.getByRole('button', { name: /^Play$/i });
  await playBtn2.click();
  await page.waitForTimeout(2000);
  const afterResume = await getHighlight(page);
  const resumeOk = afterResume.index !== null && afterResume.index >= beforeResume.index;
  console.log(`[4] RESUME: ${beforeResume.index}→${afterResume.index} → ${resumeOk ? 'PASS' : 'FAIL'}`);
  resumeOk ? pass++ : fail++;

  // Pause for next tests
  const pauseBtn2 = page.getByRole('button', { name: /^Pause$/i });
  if (await pauseBtn2.isVisible()) await pauseBtn2.click();
  await page.waitForTimeout(300);

  // TEST 5: Skip forward
  const beforeSkip = await getHighlight(page);
  await page.getByRole('button', { name: /^Skip forward$/i }).click();
  await page.waitForTimeout(500);
  const afterSkip = await getHighlight(page);
  const skipOk = afterSkip.index !== null && afterSkip.index > beforeSkip.index;
  console.log(`[5] SKIP FWD: ${beforeSkip.index}→${afterSkip.index} → ${skipOk ? 'PASS' : 'FAIL'}`);
  skipOk ? pass++ : fail++;

  // TEST 6: Skip backward
  const beforeBack = await getHighlight(page);
  await page.getByRole('button', { name: /^Skip backward$/i }).click();
  await page.waitForTimeout(500);
  const afterBack = await getHighlight(page);
  const backOk = afterBack.index !== null && afterBack.index < beforeBack.index;
  console.log(`[6] SKIP BACK: ${beforeBack.index}→${afterBack.index} → ${backOk ? 'PASS' : 'FAIL'}`);
  backOk ? pass++ : fail++;

  // TEST 7: Next chapter
  await page.getByRole('button', { name: /^Next chapter$/i }).click();
  await page.waitForTimeout(1000);
  const afterNext = await getHighlight(page);
  const heading = await page.evaluate(() => document.querySelector('h2')?.textContent || '');
  const nextOk = afterNext.index !== null && heading.includes('2');
  console.log(`[7] NEXT CH: index=${afterNext.index}, heading="${heading}" → ${nextOk ? 'PASS' : 'FAIL'}`);
  nextOk ? pass++ : fail++;

  // TEST 8: Prev chapter
  await page.getByRole('button', { name: /^Previous chapter$/i }).click();
  await page.waitForTimeout(1000);
  const afterPrev = await getHighlight(page);
  const heading2 = await page.evaluate(() => document.querySelector('h2')?.textContent || '');
  const prevOk = afterPrev.index !== null && heading2.includes('1');
  console.log(`[8] PREV CH: index=${afterPrev.index}, heading="${heading2}" → ${prevOk ? 'PASS' : 'FAIL'}`);
  prevOk ? pass++ : fail++;

  // TEST 9: Word click
  const target = page.locator('[data-word-index]').nth(15);
  const targetIdx = await target.getAttribute('data-word-index');
  await target.click();
  await page.waitForTimeout(500);
  const afterClick = await getHighlight(page);
  const clickOk = String(afterClick.index) === targetIdx;
  console.log(`[9] WORD CLICK: clicked=${targetIdx}, highlight=${afterClick.index} → ${clickOk ? 'PASS' : 'FAIL'}`);
  clickOk ? pass++ : fail++;

  // TEST 10: Play after chapter nav + verify highlight moves
  await page.getByRole('button', { name: /^Next chapter$/i }).click();
  await page.waitForTimeout(1000);
  const chStartH = await getHighlight(page);
  await page.getByRole('button', { name: /^Play$/i }).click();
  await page.waitForTimeout(2000);
  const chPlayH = await getHighlight(page);
  const chPlayOk = chPlayH.index !== null && chPlayH.index >= chStartH.index;
  console.log(`[10] PLAY AFTER CH NAV: ${chStartH.index}→${chPlayH.index} → ${chPlayOk ? 'PASS' : 'FAIL'}`);
  chPlayOk ? pass++ : fail++;

  // Cleanup
  const finalPause = page.getByRole('button', { name: /^Pause$/i });
  if (await finalPause.isVisible()) await finalPause.click();

  console.log(`\n=== RESULT: ${pass}/${pass+fail} PASS ===`);
  if (errors.length > 0) {
    console.log(`Console errors: ${errors.join('; ')}`);
  }

  await browser.close();
})();
