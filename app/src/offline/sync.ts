import {
  deleteItem,
  errorMessage,
  isConflict,
  listItems,
  subscribeToItems,
  upsertItem,
} from '../api';
import type { Item } from '../api';
import type { GroceryDB } from './db';

/*
 * Offline-first sync
 * ------------------
 * 1. Every change is written to the local database AND queued in the outbox,
 *    in one transaction. The screen reads only from the local database.
 * 2. flush() sends queued changes to the server in order. Network failures
 *    leave them queued; conflicts (server has a newer edit) are dropped.
 * 3. pull() downloads the household's list and merges it in, keeping any
 *    local edit that is newer or still waiting to be sent.
 * 4. A live subscription merges other people's changes as they happen.
 */

type ErrorReporter = (message: string) => void;
let reportError: ErrorReporter = () => undefined;

// True for failures that are worth retrying later (no signal, timeouts).
export function isTransient(e: unknown): boolean {
  if (!navigator.onLine) return true;
  return /network|failed to fetch|load failed|timed? ?out|offline|socket|connection/i.test(
    errorMessage(e),
  );
}

// Last-write-wins: only accept an incoming copy if it is at least as new.
export async function mergeRemote(db: GroceryDB, incoming: Item): Promise<void> {
  await db.transaction('rw', db.items, async () => {
    const local = await db.items.get(incoming.id);
    if (local && local.updatedAt > incoming.updatedAt) return;
    await db.items.put(incoming);
  });
}

// Save a change locally and queue it for the server.
export async function queueChange(db: GroceryDB, op: 'upsert' | 'delete', item: Item): Promise<void> {
  await db.transaction('rw', db.items, db.outbox, async () => {
    await db.items.put(item);
    // Compact the queue: each entry carries the item's full state, so only
    // the latest change per item needs to be sent.
    await db.outbox.where('itemId').equals(item.id).delete();
    await db.outbox.add({
      op,
      householdId: item.householdId,
      itemId: item.id,
      item,
      queuedAt: new Date().toISOString(),
    });
  });
  void flush(db);
}

let flushing: Promise<boolean> | null = null;

// Send queued changes. Returns true if anything was rejected as a conflict,
// meaning a pull is needed to fetch the newer server version.
export function flush(db: GroceryDB): Promise<boolean> {
  if (!flushing) {
    flushing = sendQueued(db).finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function sendQueued(db: GroceryDB): Promise<boolean> {
  let hadConflict = false;
  while (navigator.onLine) {
    const entry = await db.outbox.orderBy('seq').first();
    if (!entry || entry.seq === undefined) break;

    try {
      const saved =
        entry.op === 'delete'
          ? await deleteItem(entry.householdId, entry.itemId, entry.item.updatedAt)
          : await upsertItem(entry.item);
      await db.outbox.delete(entry.seq);
      await mergeRemote(db, saved);
    } catch (e) {
      if (isConflict(e)) {
        // The server already has a newer edit; it wins. Drop ours.
        await db.outbox.delete(entry.seq);
        hadConflict = true;
      } else if (isTransient(e)) {
        break; // keep it queued and try again later
      } else {
        // Permanent failure (e.g. no longer a member): drop it so the queue
        // can't get stuck, and tell the user.
        await db.outbox.delete(entry.seq);
        reportError(`A change couldn't be saved: ${errorMessage(e)}`);
      }
    }
  }
  return hadConflict;
}

// Download the current list and merge it with what's on this device.
export async function pull(db: GroceryDB, householdId: string): Promise<void> {
  const serverItems = await listItems(householdId);
  const serverIds = new Set(serverItems.map((i) => i.id));

  await db.transaction('rw', db.items, db.outbox, async () => {
    const pending = new Set(
      (await db.outbox.where('householdId').equals(householdId).toArray()).map((e) => e.itemId),
    );

    for (const remote of serverItems) {
      const local = await db.items.get(remote.id);
      // A newer local edit (e.g. one still waiting to be sent) wins.
      if (!local || local.updatedAt <= remote.updatedAt) await db.items.put(remote);
    }

    // Anything we have that the server doesn't (deleted elsewhere), and that
    // isn't waiting to be sent, is removed from this device.
    const locals = await db.items.where('householdId').equals(householdId).toArray();
    const gone = locals.filter((l) => !serverIds.has(l.id) && !pending.has(l.id)).map((l) => l.id);
    await db.items.bulkDelete(gone);
  });
}

// Keep one household in sync while its screen is open. Returns a stop function.
export function startSync(db: GroceryDB, householdId: string, onError: ErrorReporter): () => void {
  let stopped = false;
  let unsubscribe: () => void = () => undefined;
  reportError = onError;

  const syncNow = async () => {
    if (stopped || !navigator.onLine) return;
    try {
      await flush(db);
      await pull(db, householdId);
    } catch (e) {
      if (!isTransient(e)) onError(errorMessage(e));
    }
  };

  const connect = () => {
    unsubscribe();
    unsubscribe = subscribeToItems(
      householdId,
      (item) => {
        void mergeRemote(db, item);
      },
      () => undefined, // reconnects on the next 'online' event
    );
  };

  const onOnline = () => {
    connect();
    void syncNow();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow();
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  // Retry queued changes every 30s (no request is made if the queue is empty).
  const timer = window.setInterval(() => void flush(db), 30_000);

  if (navigator.onLine) connect();
  void syncNow();

  return () => {
    stopped = true;
    unsubscribe();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}
