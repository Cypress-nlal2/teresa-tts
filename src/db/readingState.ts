import type { ReadingState } from '@/types';
import { getDB } from './connection';

export async function saveReadingState(state: ReadingState): Promise<void> {
  const db = await getDB();
  await db.put('readingState', state);
}

export async function getReadingState(
  docId: string,
): Promise<ReadingState | undefined> {
  const db = await getDB();
  return db.get('readingState', docId);
}

export async function deleteReadingState(docId: string): Promise<void> {
  const db = await getDB();
  await db.delete('readingState', docId);
}
