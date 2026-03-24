/** Messages FROM main thread TO worker */
export type ParserWorkerMessage = {
  type: 'parse';
  fileBuffer: ArrayBuffer;
  fileName: string;
};

/** Messages FROM worker TO main thread */
export type ParserWorkerResponse =
  | { type: 'progress'; percent: number }
  | { type: 'chapter'; title: string; text: string; chapterIndex: number }
  | { type: 'complete'; title: string; totalChapters: number }
  | { type: 'error'; message: string };
