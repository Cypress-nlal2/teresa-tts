import type { DocumentMeta, Word } from '@/types';
import { getDB } from './connection';

export async function saveDocument(
  meta: DocumentMeta,
  wordsByChapter: Word[][],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['documents', 'chapterWords'], 'readwrite');

  tx.objectStore('documents').put(meta);

  const chapterStore = tx.objectStore('chapterWords');
  for (let i = 0; i < wordsByChapter.length; i++) {
    chapterStore.put({
      docId: meta.id,
      chapterIndex: i,
      words: wordsByChapter[i],
    });
  }

  await tx.done;
}

export async function getDocument(
  id: string,
): Promise<DocumentMeta | undefined> {
  const db = await getDB();
  return db.get('documents', id);
}

export async function getAllDocuments(): Promise<DocumentMeta[]> {
  const db = await getDB();
  const docs = await db.getAllFromIndex('documents', 'by-added');
  return docs.reverse();
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['documents', 'chapterWords', 'readingState'],
    'readwrite',
  );

  tx.objectStore('documents').delete(id);
  tx.objectStore('readingState').delete(id);

  const chapterStore = tx.objectStore('chapterWords');
  const chapterKeys = await chapterStore.index('by-doc').getAllKeys(id);
  for (const key of chapterKeys) {
    chapterStore.delete(key);
  }

  await tx.done;
}

export async function getChapterWords(
  docId: string,
  chapterIndex: number,
): Promise<Word[]> {
  const db = await getDB();
  const record = await db.get('chapterWords', [docId, chapterIndex]);
  return record?.words ?? [];
}

export async function getAdjacentChapterWords(
  docId: string,
  chapterIndex: number,
): Promise<{ prev: Word[] | null; current: Word[]; next: Word[] | null }> {
  const db = await getDB();
  const tx = db.transaction('chapterWords', 'readonly');
  const store = tx.objectStore('chapterWords');

  const [prevRecord, currentRecord, nextRecord] = await Promise.all([
    chapterIndex > 0
      ? store.get([docId, chapterIndex - 1])
      : Promise.resolve(undefined),
    store.get([docId, chapterIndex]),
    store.get([docId, chapterIndex + 1]),
  ]);

  await tx.done;

  return {
    prev: prevRecord?.words ?? null,
    current: currentRecord?.words ?? [],
    next: nextRecord?.words ?? null,
  };
}
