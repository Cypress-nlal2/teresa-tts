import { TTSEngineBase } from '../TTSEngineBase';

/**
 * Chrome Desktop TTS engine.
 *
 * Has reliable boundary events, standard rate limits, and reliable onend.
 * This is the default/fallback engine for unrecognized browsers.
 */
export class ChromeDesktopEngine extends TTSEngineBase {
  // All defaults from TTSEngineBase match Chrome Desktop behavior.
  // No overrides needed.
}
