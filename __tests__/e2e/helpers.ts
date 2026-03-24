import { Page, expect } from '@playwright/test';
import path from 'path';

/** Path to the sample.txt fixture file */
export const SAMPLE_TXT_PATH = path.resolve(__dirname, '..', 'fixtures', 'sample.txt');

/** Clear the IndexedDB database used by the app */
export async function clearDatabase(page: Page): Promise<void> {
  // Navigate to the app first so IndexedDB is accessible (blocked on about:blank)
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('teresa-tts');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

/** Collect console errors during a test */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

/** Upload the sample.txt file via the file chooser */
export async function uploadSampleFile(page: Page): Promise<void> {
  // Look for the upload zone and trigger a file chooser
  const fileChooserPromise = page.waitForEvent('filechooser');

  // Try clicking a browse button or the upload zone itself
  const browseButton = page.getByRole('button', { name: /browse/i });
  const uploadZone = page.locator('[class*="upload"], [class*="drop"], [data-testid="upload-zone"]').first();

  if (await browseButton.isVisible().catch(() => false)) {
    await browseButton.click();
  } else if (await uploadZone.isVisible().catch(() => false)) {
    await uploadZone.click();
  } else {
    // Fall back to finding any file input
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(SAMPLE_TXT_PATH);
    return;
  }

  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(SAMPLE_TXT_PATH);
}

/** Upload a file using the hidden input directly (most reliable) */
export async function uploadFileViaInput(page: Page): Promise<void> {
  const input = page.locator('input[type="file"]');
  if (await input.count() > 0) {
    await input.setInputFiles(SAMPLE_TXT_PATH);
  } else {
    // If no input, use the filechooser approach
    await uploadSampleFile(page);
  }
}

/** Navigate to the library page and wait for it to load */
export async function goToLibrary(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

/** Upload a file and navigate to its reader page */
export async function uploadAndOpenReader(page: Page): Promise<void> {
  await goToLibrary(page);
  await uploadFileViaInput(page);

  // Wait for the document card to appear
  const card = page.locator('[class*="card"], [data-testid="document-card"]').first();
  await card.waitFor({ state: 'visible', timeout: 10000 });

  // Click the card to open the reader
  await card.click();

  // Wait for the reader page to load
  await page.waitForURL(/\/reader\//);
  await page.waitForLoadState('networkidle');

  // Wait for word elements to render (indicates chapter data loaded from IndexedDB)
  const wordElement = page.locator('[data-word-index]').first();
  await wordElement.waitFor({ state: 'visible', timeout: 10000 });
}

/** Inject a SpeechSynthesis mock into the page */
export async function mockSpeechSynthesis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mockUtterance = class {
      text: string;
      rate = 1;
      voice = null;
      onend: ((e: any) => void) | null = null;
      onboundary: ((e: any) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      onstart: (() => void) | null = null;
      onpause: (() => void) | null = null;
      onresume: (() => void) | null = null;
      lang = '';
      pitch = 1;
      volume = 1;
      constructor(text?: string) {
        this.text = text ?? '';
      }
    };

    let currentUtterance: any = null;
    let isSpeaking = false;
    let isPaused = false;
    let boundaryTimer: any = null;

    const mockSynth = {
      speak: (utterance: any) => {
        currentUtterance = utterance;
        isSpeaking = true;
        isPaused = false;
        mockSynth.speaking = true;
        mockSynth.paused = false;
        utterance.onstart?.();

        // Simulate word boundary events
        const words = utterance.text.split(/\s+/).filter(Boolean);
        let charIndex = 0;
        let wordIndex = 0;

        const fireNextBoundary = () => {
          if (wordIndex < words.length && isSpeaking && !isPaused) {
            const word = words[wordIndex];
            utterance.onboundary?.({
              charIndex,
              charLength: word.length,
              name: 'word',
            });
            charIndex += word.length + 1;
            wordIndex++;
            boundaryTimer = setTimeout(fireNextBoundary, 80);
          } else if (wordIndex >= words.length) {
            isSpeaking = false;
            mockSynth.speaking = false;
            utterance.onend?.();
          }
        };
        boundaryTimer = setTimeout(fireNextBoundary, 50);
      },
      cancel: () => {
        if (boundaryTimer) clearTimeout(boundaryTimer);
        isSpeaking = false;
        isPaused = false;
        mockSynth.speaking = false;
        mockSynth.paused = false;
        if (currentUtterance) {
          currentUtterance.onerror?.({ error: 'canceled' });
          currentUtterance = null;
        }
      },
      pause: () => {
        isPaused = true;
        mockSynth.paused = true;
        if (boundaryTimer) clearTimeout(boundaryTimer);
        if (currentUtterance) currentUtterance.onpause?.();
      },
      resume: () => {
        isPaused = false;
        mockSynth.paused = false;
        if (currentUtterance) currentUtterance.onresume?.();
      },
      speaking: false,
      paused: false,
      pending: false,
      getVoices: () => [
        {
          name: 'Test Voice',
          lang: 'en-US',
          voiceURI: 'test-voice',
          localService: true,
          default: true,
        },
        {
          name: 'Second Voice',
          lang: 'en-GB',
          voiceURI: 'second-voice',
          localService: true,
          default: false,
        },
      ],
      addEventListener: (event: string, handler: () => void) => {
        if (event === 'voiceschanged') setTimeout(handler, 10);
      },
      removeEventListener: () => {},
    };

    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSynth,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: mockUtterance,
      writable: true,
      configurable: true,
    });
  });
}

/** Focus the document body to ensure keyboard shortcuts work (no button focused) */
export async function focusBody(page: Page): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    document.body.focus();
  });
}

/** Take a screenshot with a descriptive name */
export async function takeScreenshot(
  page: Page,
  name: string,
  fullPage = true
): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage,
  });
}
