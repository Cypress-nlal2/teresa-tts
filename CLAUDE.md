# Teresa TTS <3

Tech stack: Next.js 16, TypeScript, Tailwind CSS v4, Zustand, IndexedDB (idb), pdfjs-dist v4, mammoth.js
Build: `npm run build`
Test: `npm test` (Vitest)
Lint: `npm run lint` (ESLint)
Dev: `npm run dev`

## Architecture
- Client-side TTS app using Web Speech API (SpeechSynthesis)
- Documents parsed on main thread with async batching for large files
- Word-level highlighting via direct DOM manipulation (not React state)
- Per-chapter IndexedDB storage for memory efficiency
- Platform-specific TTS strategies (Safari/Chrome Android use cancel-for-pause)

## Key Design Decisions
- Sentence-based TTS chunking (20-50 words) to stay under Chrome's 15s timeout
- Binary search for charIndex → word mapping with time-estimation fallback
- CSS custom properties for theming with class-based dark mode (@custom-variant)
- No Web Workers for parsing — uses main-thread async batching for Safari compatibility

## Directory Structure
- src/engine/tts/ — TTS engine (ChunkBuilder, BoundaryTracker, TTSEngine)
- src/engine/parser/ — Document parsers (PDF, DOCX, TXT)
- src/components/ — React components (library/, reader/, shared/)
- src/store/ — Zustand store with 4 slices
- src/db/ — IndexedDB operations
- src/hooks/ — React hooks (useTTS, useDocumentParser, useKeyboardShortcuts)
