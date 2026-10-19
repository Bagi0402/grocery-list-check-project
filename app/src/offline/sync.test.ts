import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '../api';

// Replace the network layer with controllable fakes.
const api = vi.hoisted(() => ({
  upsertItem: vi.fn(),
  deleteItem: vi.fn(),
  listItems: vi.fn(),
}));

vi.mock('../api', () => ({
  upsertItem: api.upsertItem,
  deleteItem: api.deleteItem,
  listItems: api.listItems,
  subscribeToItems: vi.fn(() => () => undefined),
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  isConflict: (e: unknown) => e instanceof Error && e.message === 'Conflict',
}));

import { openDb } from './db';
import type { GroceryDB } from './db';
import { flush, mergeRemote, pull, queueChange } from './sync';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';
const T3 = '2026-01-03T00:00:00.000Z';

function item(overrides: Partial<Item> = {}): Item {
  return {
    householdId: 'h1',
    id: 'i1',
    name: 'Milk',
    qty: null,
    category: null,
    checked: false,
    assignedTo: null,
    updatedAt: T1,
    updatedBy: 'u1',
    deletedAt: null,
    ...overrides,
  };
}

function setOnline(online: boolean) {
  vi.stubGlobal('navigator', { onLine: online });
}

// Queue a change without the automatic background send, so each test
// controls exactly when flush() runs.
async function queueOffline(op: 'upsert' | 'delete', value: Item) {
  setOnline(false);
  await queueChange(db, op, value);
  setOnline(true);
}

let db: GroceryDB;
let dbCount = 0;

beforeEach(() => {
  db = openDb(`test-${dbCount++}`);
  setOnline(true);
  vi.clearAllMocks();
});

afterEach(async () => {
  await db.delete();
  vi.unstubAllGlobals();
});

describe('queueChange', () => {
  it('saves changes on the device and keeps only the latest change per item', async () => {
    await queueOffline('upsert', item({ updatedAt: T1 }));
    await queueOffline('upsert', item({ checked: true, updatedAt: T2 }));

    expect((await db.items.get('i1'))?.checked).toBe(true);
    const queued = await db.outbox.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].item.checked).toBe(true);
    expect(api.upsertItem).not.toHaveBeenCalled();
  });
});

describe('flush', () => {
  it('sends queued changes and empties the queue', async () => {
    api.upsertItem.mockImplementation(async (value: Item) => value);
    await queueOffline('upsert', item());

    expect(await flush(db)).toBe(false);
    expect(api.upsertItem).toHaveBeenCalledTimes(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it('sends deletions with the time they were made', async () => {
    api.deleteItem.mockImplementation(async () => item({ deletedAt: T2, updatedAt: T2 }));
    await queueOffline('delete', item({ deletedAt: T2, updatedAt: T2 }));

    await flush(db);
    expect(api.deleteItem).toHaveBeenCalledWith('h1', 'i1', T2);
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps changes queued when the network fails', async () => {
    api.upsertItem.mockRejectedValue(new Error('Network error'));
    await queueOffline('upsert', item());

    await flush(db);
    expect(await db.outbox.count()).toBe(1);
  });

  it('drops a change the server rejects as a conflict and asks for a pull', async () => {
    api.upsertItem.mockRejectedValue(new Error('Conflict'));
    await queueOffline('upsert', item());

    expect(await flush(db)).toBe(true);
    expect(await db.outbox.count()).toBe(0);
  });

  it('does nothing while offline', async () => {
    await queueOffline('upsert', item());
    setOnline(false);

    await flush(db);
    expect(api.upsertItem).not.toHaveBeenCalled();
    expect(await db.outbox.count()).toBe(1);
  });
});

describe('mergeRemote', () => {
  it('keeps whichever copy was edited last', async () => {
    await db.items.put(item({ name: 'Oat milk', updatedAt: T2 }));

    await mergeRemote(db, item({ name: 'Milk', updatedAt: T1 }));
    expect((await db.items.get('i1'))?.name).toBe('Oat milk');

    await mergeRemote(db, item({ name: 'Soy milk', updatedAt: T3 }));
    expect((await db.items.get('i1'))?.name).toBe('Soy milk');
  });
});

describe('pull', () => {
  it('removes items deleted elsewhere but keeps ones not sent yet', async () => {
    await db.items.put(item({ id: 'deleted-elsewhere' }));
    await queueOffline('upsert', item({ id: 'new-offline', name: 'Eggs' }));
    api.listItems.mockResolvedValue([item({ id: 'on-server', name: 'Bread' })]);

    await pull(db, 'h1');

    const ids = (await db.items.toArray()).map((i) => i.id).sort();
    expect(ids).toEqual(['new-offline', 'on-server']);
  });

  it('keeps a newer local edit over an older server copy', async () => {
    await queueOffline('upsert', item({ name: 'Oat milk', updatedAt: T3 }));
    api.listItems.mockResolvedValue([item({ name: 'Milk', updatedAt: T2 })]);

    await pull(db, 'h1');
    expect((await db.items.get('i1'))?.name).toBe('Oat milk');
  });
});
