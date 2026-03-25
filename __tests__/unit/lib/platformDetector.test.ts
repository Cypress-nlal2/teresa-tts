import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('platformDetector + TTS engine factory', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('Chrome desktop creates engine with boundary events and standard rates', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      maxTouchPoints: 0,
    });

    const { createTTSEngine } = await import('@/engine/tts/createTTSEngine');
    const engine = createTTSEngine({ onWordChange: () => {}, onPlaybackStateChange: () => {}, onChunkComplete: () => {}, onFinished: () => {}, onError: () => {} });

    expect(engine.minRate).toBe(0.5);
    expect(engine.maxRate).toBe(3.0);
    expect(engine.constructor.name).toBe('ChromeDesktopEngine');
  });

  it('Safari creates engine with narrow rate range', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });

    const { createTTSEngine } = await import('@/engine/tts/createTTSEngine');
    const engine = createTTSEngine({ onWordChange: () => {}, onPlaybackStateChange: () => {}, onChunkComplete: () => {}, onFinished: () => {}, onError: () => {} });

    expect(engine.minRate).toBe(0.8);
    expect(engine.maxRate).toBe(2.0);
    expect(engine.constructor.name).toBe('SafariEngine');
  });

  it('Chrome Android creates correct engine', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
    });

    const { createTTSEngine } = await import('@/engine/tts/createTTSEngine');
    const engine = createTTSEngine({ onWordChange: () => {}, onPlaybackStateChange: () => {}, onChunkComplete: () => {}, onFinished: () => {}, onError: () => {} });

    expect(engine.minRate).toBe(0.5);
    expect(engine.maxRate).toBe(3.0);
    expect(engine.constructor.name).toBe('ChromeAndroidEngine');
  });

  it('Firefox Linux creates correct engine', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
      platform: 'Linux x86_64',
      maxTouchPoints: 0,
    });

    const { createTTSEngine } = await import('@/engine/tts/createTTSEngine');
    const engine = createTTSEngine({ onWordChange: () => {}, onPlaybackStateChange: () => {}, onChunkComplete: () => {}, onFinished: () => {}, onError: () => {} });

    expect(engine.minRate).toBe(0.5);
    expect(engine.maxRate).toBe(3.0);
    expect(engine.constructor.name).toBe('FirefoxLinuxEngine');
  });
});
