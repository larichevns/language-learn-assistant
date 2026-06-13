'use client';

/**
 * Offline write outbox. SRS/grammar grades made offline are queued in IndexedDB
 * and replayed when connectivity returns — the cross-platform alternative to the
 * Background Sync API (which iOS Safari lacks). Reads are cached by the service
 * worker; this handles writes. See vault/knowledge/business/post-mvp-backlog.md.
 */
import { apiPost, ApiClientError } from '../api/client';

const DB_NAME = 'lla-offline';
const STORE = 'outbox';
const CHANGE_EVENT = 'lla-outbox-change';

interface OutboxItem {
  id?: number;
  url: string;
  body: unknown;
  queuedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function emitChange(): void {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Subscribe to outbox size changes (enqueue/flush). Returns an unsubscribe fn. */
export function onOutboxChange(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

export async function pendingCount(): Promise<number> {
  try {
    return await run<number>('readonly', (s) => s.count());
  } catch {
    return 0;
  }
}

/** A "couldn't reach the server" failure (queue it) vs a real server answer (surface it). */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof ApiClientError) return false; // the server answered → not a connectivity problem
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return e instanceof TypeError; // fetch() rejects with TypeError when the network is unreachable
}

/**
 * POST that survives offline. Tries the request; if the network is unreachable,
 * queues it to replay later and resolves `{ queued: true }`. A real server error
 * (4xx/5xx — the server answered) still throws so callers can react.
 */
export async function postOrQueue(url: string, body: unknown): Promise<{ queued: boolean }> {
  try {
    await apiPost(url, body);
    return { queued: false };
  } catch (e) {
    if (isNetworkError(e)) {
      await run('readwrite', (s) => s.add({ url, body, queuedAt: Date.now() } satisfies OutboxItem));
      emitChange();
      return { queued: true };
    }
    throw e;
  }
}

let flushing = false;

/** Replay queued writes oldest-first. Stops at the first connectivity failure (retry later). */
export async function flushOutbox(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let synced = 0;
  try {
    const items = await run<OutboxItem[]>('readonly', (s) => s.getAll());
    for (const item of items) {
      try {
        await apiPost(item.url, item.body);
        await run('readwrite', (s) => s.delete(item.id as number));
        synced += 1;
      } catch (e) {
        if (e instanceof ApiClientError && e.status >= 400 && e.status < 500) {
          // The server rejected it (stale card, duplicate, gone) — won't ever succeed; drop it.
          await run('readwrite', (s) => s.delete(item.id as number));
          synced += 1;
        } else {
          break; // still offline or a transient 5xx — keep it and retry next time
        }
      }
    }
  } finally {
    flushing = false;
    if (synced) emitChange();
  }
  return synced;
}
