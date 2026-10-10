import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { Item } from '../api';

// A change waiting to be sent to the server.
export type OutboxEntry = {
  seq?: number; // auto-increment: keeps changes in the order they were made
  op: 'upsert' | 'delete';
  householdId: string;
  itemId: string;
  item: Item; // full item state at the time of the change
  queuedAt: string;
};

export type MetaEntry = {
  key: string;
  value: unknown;
};

export type GroceryDB = Dexie & {
  items: EntityTable<Item, 'id'>;
  outbox: EntityTable<OutboxEntry, 'seq'>;
  meta: EntityTable<MetaEntry, 'key'>;
};

// One database per signed-in user, so people sharing a device never see
// each other's data.
export function openDb(userId: string): GroceryDB {
  const db = new Dexie(`grocery-${userId}`) as GroceryDB;
  db.version(1).stores({
    items: 'id, householdId',
    outbox: '++seq, householdId, itemId',
    meta: 'key',
  });
  return db;
}

export const MEMBERSHIPS_KEY = 'memberships';
export const membersKey = (householdId: string) => `members:${householdId}`;

export async function readMeta<T>(db: GroceryDB, key: string): Promise<T | undefined> {
  const entry = await db.meta.get(key);
  return entry ? (entry.value as T) : undefined;
}

export async function writeMeta(db: GroceryDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
