import { TTSEngineBase } from '../TTSEngineBase';

/**
 * Firefox on Linux TTS engine.
 *
 * No reliable boundary events — uses time-based word estimation.
 * onend is reliable, so no Safari end timer needed.
 */
export class FirefoxLinuxEngine extends TTSEngineBase {
  protected get hasBoundaryEvents(): boolean { return false; }
}
