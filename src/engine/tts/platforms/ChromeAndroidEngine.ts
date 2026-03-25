import { TTSEngineBase } from '../TTSEngineBase';

/**
 * Chrome Android TTS engine.
 *
 * No reliable boundary events — uses time-based word estimation.
 * Needs the Safari end timer because onend can be unreliable on mobile.
 */
export class ChromeAndroidEngine extends TTSEngineBase {
  protected get hasBoundaryEvents(): boolean { return false; }
  protected get needsSafariEndTimer(): boolean { return true; }
}
