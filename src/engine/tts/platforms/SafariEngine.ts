import { TTSEngineBase } from '../TTSEngineBase';

/**
 * Safari TTS engine (macOS and iOS).
 *
 * No reliable boundary events — uses time-based word estimation.
 * Needs the Safari end timer because onend often doesn't fire.
 * Narrower rate range (0.8–2.0) because Safari ignores extreme values.
 * getVoices() returns empty — voice selector is hidden by the UI.
 */
export class SafariEngine extends TTSEngineBase {
  protected get hasBoundaryEvents(): boolean { return false; }
  protected get needsSafariEndTimer(): boolean { return true; }
  get minRate(): number { return 0.8; }
  get maxRate(): number { return 2.0; }
}
