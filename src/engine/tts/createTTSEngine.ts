import type { TTSCallbacks } from './types';
import type { TTSEngineBase } from './TTSEngineBase';
import { isSafari, isChromeAndroid, isFirefoxLinux } from '@/lib/platformDetector';
import { ChromeDesktopEngine, ChromeAndroidEngine, SafariEngine, FirefoxLinuxEngine } from './platforms';

/**
 * Factory function that detects the browser platform and returns
 * the appropriate TTS engine subclass.
 */
export function createTTSEngine(callbacks: TTSCallbacks): TTSEngineBase {
  if (isSafari())        return new SafariEngine(callbacks);
  if (isChromeAndroid()) return new ChromeAndroidEngine(callbacks);
  if (isFirefoxLinux())  return new FirefoxLinuxEngine(callbacks);
  return new ChromeDesktopEngine(callbacks);
}
