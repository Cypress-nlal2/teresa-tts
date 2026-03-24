export interface StorageAvailability {
  available: boolean;
  persistent: boolean;
  estimatedQuota: number | null;
}

export async function checkStorageAvailability(): Promise<StorageAvailability> {
  const result: StorageAvailability = {
    available: false,
    persistent: false,
    estimatedQuota: null,
  };

  // Test IndexedDB availability
  try {
    const testDbName = '__teresa_storage_test__';
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(testDbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('test')) {
          db.createObjectStore('test');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Try writing a test record
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('test', 'readwrite');
      tx.objectStore('test').put('ok', 'check');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
    indexedDB.deleteDatabase(testDbName);
    result.available = true;
  } catch {
    return result;
  }

  // Check storage persistence
  try {
    if (navigator.storage && navigator.storage.persist) {
      result.persistent = await navigator.storage.persist();
    }
  } catch {
    // persist() not available (e.g. private browsing)
  }

  // Check estimated quota
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      result.estimatedQuota = estimate.quota ?? null;
    }
  } catch {
    // estimate() not available
  }

  return result;
}
