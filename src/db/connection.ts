import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { TeresaDB } from './schema';
import { DB_NAME, DB_VERSION } from '@/lib/constants';

let dbPromise: Promise<IDBPDatabase<TeresaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TeresaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TeresaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('by-added', 'addedAt');

        const chapterStore = db.createObjectStore('chapterWords', {
          keyPath: ['docId', 'chapterIndex'],
        });
        chapterStore.createIndex('by-doc', 'docId');

        db.createObjectStore('readingState', { keyPath: 'docId' });
      },
    });
  }
  return dbPromise;
}
