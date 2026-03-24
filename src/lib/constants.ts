export const APP_NAME = 'Teresa TTS <3';
export const DB_NAME = 'teresa-tts';
export const DB_VERSION = 1;
export const WORDS_PER_MINUTE_BASE = 150;
export const DEFAULT_SPEED = 1.0;
export const MIN_SPEED = 0.5;
export const MAX_SPEED = 3.0;
export const SAFARI_MIN_SPEED = 0.8;
export const SAFARI_MAX_SPEED = 2.0;
export const SKIP_FORWARD_WORDS = 75;
export const SKIP_BACKWARD_WORDS = 25;
export const POSITION_SAVE_DEBOUNCE_MS = 2000;
export const SUPPORTED_FORMATS = ['pdf', 'docx', 'txt', 'epub'] as const;
export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'text/plain': 'txt',
  'application/epub+zip': 'epub',
};
