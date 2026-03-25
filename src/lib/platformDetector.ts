/**
 * Browser/platform detection helpers.
 *
 * Used by the TTS engine factory (createTTSEngine) to select the right
 * platform subclass, and by UI components for Safari-specific behavior.
 */

let cachedIsSafari: boolean | null = null;
let cachedIsSafariIOS: boolean | null = null;
let cachedIsChromeAndroid: boolean | null = null;
let cachedIsFirefoxLinux: boolean | null = null;

function getUA(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent;
}

export function isSafari(): boolean {
  if (cachedIsSafari !== null) return cachedIsSafari;
  const ua = getUA();
  cachedIsSafari =
    /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
  return cachedIsSafari;
}

export function isSafariIOS(): boolean {
  if (cachedIsSafariIOS !== null) return cachedIsSafariIOS;
  const ua = getUA();
  cachedIsSafariIOS =
    (/iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
    isSafari();
  return cachedIsSafariIOS;
}

export function isChromeAndroid(): boolean {
  if (cachedIsChromeAndroid !== null) return cachedIsChromeAndroid;
  const ua = getUA();
  cachedIsChromeAndroid = /Android/.test(ua) && /Chrome/.test(ua);
  return cachedIsChromeAndroid;
}

export function isFirefoxLinux(): boolean {
  if (cachedIsFirefoxLinux !== null) return cachedIsFirefoxLinux;
  const ua = getUA();
  cachedIsFirefoxLinux = /Firefox/.test(ua) && /Linux/.test(ua) && !/Android/.test(ua);
  return cachedIsFirefoxLinux;
}
