import { TTSEngineBase } from '../TTSEngineBase';

/**
 * Safari TTS engine (macOS and iOS).
 *
 * No reliable boundary events — uses time-based word estimation.
 * Needs the Safari end timer because onend often doesn't fire.
 * Narrower rate range (0.8–2.0) because Safari ignores extreme values.
 *
 * Safari's rate is nonlinear — 2.0 in Safari feels like ~3x in Chrome.
 * We scale the rate down so the user-facing speed feels consistent.
 */
export class SafariEngine extends TTSEngineBase {
  protected get hasBoundaryEvents(): boolean { return false; }
  protected get needsSafariEndTimer(): boolean { return true; }
  get minRate(): number { return 0.5; }
  get maxRate(): number { return 2.0; }

  /**
   * Override setSpeed to scale the rate for Safari's nonlinear behavior.
   * User selects 1.5x → we apply ~1.25x to Safari's engine so it feels right.
   */
  setSpeed(rate: number): void {
    // Safari rate mapping: compress the user-facing range so it feels
    // consistent with Chrome. Safari's 1.0 ≈ Chrome's 1.0, but
    // Safari's 2.0 ≈ Chrome's 3.0. Apply a sqrt curve to flatten it.
    const clamped = Math.max(this.minRate, Math.min(rate, this.maxRate));
    const scaled = clamped <= 1.0
      ? clamped  // below 1x feels similar across browsers
      : 1.0 + (clamped - 1.0) * 0.6;  // above 1x: compress (2.0 → 1.6 actual)
    super.setSpeed(scaled);
  }
}
