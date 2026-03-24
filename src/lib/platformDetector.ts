interface PlatformTTSStrategy {
  useCancelForPause: boolean;
  hasBoundaryEvents: boolean;
  maxRate: number;
  minRate: number;
}

let cachedIsSafari: boolean | null = null;
let cachedIsSafariIOS: boolean | null = null;
let cachedIsChromeAndroid: boolean | null = null;
let cachedIsFirefoxLinux: boolean | null = null;
let cachedStrategy: PlatformTTSStrategy | null = null;

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

export function getPlatformTTSStrategy(): PlatformTTSStrategy {
  if (cachedStrategy !== null) return cachedStrategy;

  if (isSafari()) {
    cachedStrategy = {
      useCancelForPause: true,
      hasBoundaryEvents: false,
      maxRate: 2.0,
      minRate: 0.8,
    };
  } else if (isChromeAndroid()) {
    cachedStrategy = {
      useCancelForPause: true,
      hasBoundaryEvents: false,
      maxRate: 3.0,
      minRate: 0.5,
    };
  } else if (isFirefoxLinux()) {
    cachedStrategy = {
      useCancelForPause: false,
      hasBoundaryEvents: false,
      maxRate: 3.0,
      minRate: 0.5,
    };
  } else {
    // Chrome desktop / Edge / other Chromium
    cachedStrategy = {
      useCancelForPause: false,
      hasBoundaryEvents: true,
      maxRate: 3.0,
      minRate: 0.5,
    };
  }

  return cachedStrategy;
}
