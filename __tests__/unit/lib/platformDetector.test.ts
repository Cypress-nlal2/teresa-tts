import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to re-import fresh each test because of caching
describe('platformDetector', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('detects Chrome desktop as default strategy', async () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      maxTouchPoints: 0,
    });

    const { getPlatformTTSStrategy } = await import('@/lib/platformDetector');
    const strategy = getPlatformTTSStrategy();

    expect(strategy.useCancelForPause).toBe(false);
    expect(strategy.hasBoundaryEvents).toBe(true);
    expect(strategy.maxRate).toBe(3.0);
    expect(strategy.minRate).toBe(0.5);
  });

  it('detects Safari with cancel-for-pause strategy', async () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });

    const { getPlatformTTSStrategy, isSafari } = await import(
      '@/lib/platformDetector'
    );

    expect(isSafari()).toBe(true);
    const strategy = getPlatformTTSStrategy();
    expect(strategy.useCancelForPause).toBe(true);
    expect(strategy.hasBoundaryEvents).toBe(false);
    expect(strategy.maxRate).toBe(2.0);
  });

  it('detects Chrome Android with cancel-for-pause', async () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
    });

    const { getPlatformTTSStrategy, isChromeAndroid } = await import(
      '@/lib/platformDetector'
    );

    expect(isChromeAndroid()).toBe(true);
    const strategy = getPlatformTTSStrategy();
    expect(strategy.useCancelForPause).toBe(true);
  });

  it('detects Firefox Linux without boundary events', async () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
      platform: 'Linux x86_64',
      maxTouchPoints: 0,
    });

    const { getPlatformTTSStrategy, isFirefoxLinux } = await import(
      '@/lib/platformDetector'
    );

    expect(isFirefoxLinux()).toBe(true);
    const strategy = getPlatformTTSStrategy();
    expect(strategy.useCancelForPause).toBe(false);
    expect(strategy.hasBoundaryEvents).toBe(false);
  });
});
