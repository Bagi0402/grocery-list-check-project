import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  deleteItem,
  errorMessage,
  householdMembers,
  isConflict,
  listItems,
  subscribeToItems,
  upsertItem,
} from '../api';
import type { Item, Member, Membership } from '../api';

const CATEGORIES = ['Produce', 'Dairy', 'Bakery', 'Meat', 'Pantry', 'Frozen', 'Household', 'Other'];

type Filter = 'all' | 'mine' | 'others' | 'anyone';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Mine' },
  { key: 'others', label: 'Theirs' },
  { key: 'anyone', label: 'Anyone' },
];

type Props = {
  userId: string;
  membership: Membership;
  memberships: Membership[];
  onSwitch: (householdId: string) => void;
  onAddHousehold: () => void;
  signOut: () => void;
};

const now = () => new Date().toISOString();

function matchesFilter(item: Item, filter: Filter, userId: string): boolean {
  switch (filter) {
    case 'mine':
      return item.assignedTo === userId;
    case 'others':
      return item.assignedTo !== null && item.assignedTo !== userId;
    case 'anyone':
      return item.assignedTo === null;
    default:
      return true;
  }
}

function compareItems(a: Item, b: Item): number {
  if (a.checked !== b.checked) return a.checked ? 1 : -1;
  const ca = CATEGORIES.indexOf(a.category ?? 'Other');
  const cb = CATEGORIES.indexOf(b.category ?? 'Other');
  if (ca !== cb) return ca - cb;
  return a.name.localeCompare(b.name);
}

export default function ShoppingList({
  userId,
  membership,
  memberships,
  onSwitch,
  onAddHousehold,
  signOut,
}: Props) {
  const householdId = membership.householdId;

  // Every item we know about, keyed by id. Deleted items stay here (with
  // deletedAt set) so a late, older update can't bring them back.
  const [items, setItems] = useState<Record<string, Item>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [formError, setFormError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [list, people] = await Promise.all([
        listItems(householdId),
        householdMembers(householdId),
      ]);
      setItems(Object.fromEntries(list.map((item) => [item.id, item])));
      setMembers(people);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [householdId]);

  // Last-write-wins on the client too: ignore anything older than what we have.
  const applyRemote = useCallback((incoming: Item) => {
    setItems((prev) => {
      const existing = prev[incoming.id];
      if (existing && existing.updatedAt > incoming.updatedAt) return prev;
      return { ...prev, [incoming.id]: incoming };
    });
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeToItems(householdId, applyRemote, (e) =>
      setError(`Live updates stopped: ${errorMessage(e)}. Reload the page to reconnect.`),
    );
    // Catch up on anything missed while the tab was in the background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [householdId, refresh, applyRemote]);

  async function handleWriteError(e: unknown) {
    if (!isConflict(e)) setError(errorMessage(e));
    await refresh();
  }

  // Optimistic update: show the change immediately, then save it.
  async function save(item: Item) {
    setItems((prev) => ({ ...prev, [item.id]: item }));
    try {
      applyRemote(await upsertItem(item));
    } catch (e) {
      await handleWriteError(e);
    }
  }

  function update(item: Item, changes: Partial<Item>) {
    save({ ...item, ...changes, updatedAt: now(), updatedBy: userId });
  }

  async function remove(item: Item) {
    const t = now();
    setItems((prev) => ({ ...prev, [item.id]: { ...item, deletedAt: t, updatedAt: t } }));
    try {
      applyRemote(await deleteItem(householdId, item.id, t));
    } catch (e) {
      await handleWriteError(e);
    }
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setFormError('Enter an item name');
      return;
    }
    save({
      householdId,
      id: crypto.randomUUID(),
      name,
      qty: newQty.trim() || null,
      category: newCategory || null,
      checked: false,
      assignedTo: newAssignee || null,
      updatedAt: now(),
      updatedBy: userId,
      deletedAt: null,
    });
    setNewName('');
    setNewQty('');
  }

  function copyInvite() {
    if (!membership.inviteCode) return;
    navigator.clipboard
      .writeText(membership.inviteCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  }

  const memberName = (id: string | null): string => {
    if (!id) return 'Anyone';
    if (id === userId) return 'Me';
    return members.find((m) => m.userId === id)?.displayName ?? 'Someone';
  };

  const live = useMemo(() => Object.values(items).filter((i) => !i.deletedAt), [items]);
  const visible = useMemo(
    () => live.filter((i) => matchesFilter(i, filter, userId)).sort(compareItems),
    [live, filter, userId],
  );
  const doneCount = live.filter((i) => i.checked).length;

  const assigneeOptions = (
    <>
      <option value="">Anyone</option>
      <option value={userId}>Me</option>
      {members
        .filter((m) => m.userId !== userId)
        .map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.displayName}
          </option>
        ))}
    </>
  );

  return (
    <section className="list-page">
      <header className="topbar">
        <div>
          {memberships.length > 1 ? (
            <select
              className="household-switch"
              aria-label="Choose list"
              value={householdId}
              onChange={(e) => onSwitch(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.householdId} value={m.householdId}>
                  {m.householdName}
                </option>
              ))}
            </select>
          ) : (
            <h1>{membership.householdName}</h1>
          )}
          <p className="muted small">
            {members.length} {members.length === 1 ? 'member' : 'members'}
            {membership.inviteCode && (
              <>
                {' · Invite code '}
                <button type="button" className="code" onClick={copyInvite} title="Copy invite code">
                  {membership.inviteCode}
                </button>
                {copied && <span className="copied"> Copied</span>}
              </>
            )}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="link" onClick={onAddHousehold}>
            + List
          </button>
          <button type="button" className="link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div className="banner" role="alert">
          <span>{error}</span>
          <button type="button" className="link" aria-label="Dismiss" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}

      <form className="add-form" onSubmit={onAdd}>
        <input
          className="add-name"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setFormError('');
          }}
          placeholder="Add an item…"
          aria-label="Item name"
        />
        <input
          className="add-qty"
          value={newQty}
          onChange={(e) => setNewQty(e.target.value)}
          placeholder="Qty"
          aria-label="Quantity"
        />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} aria-label="Category">
          <option value="">Category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} aria-label="Who's buying">
          {assigneeOptions}
        </select>
        <button type="submit">Add</button>
        {formError && (
          <p className="error form-error" role="alert">
            {formError}
          </p>
        )}
      </form>

      <nav className="filters" aria-label="Filter items">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={filter === f.key ? 'chip active' : 'chip'}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="count">{live.filter((i) => matchesFilter(i, f.key, userId)).length}</span>
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="empty">
          {live.length === 0 ? 'Your list is empty. Add the first item above.' : 'Nothing here for this filter.'}
        </p>
      ) : (
        <ul className="items">
          {visible.map((item) => (
            <li key={item.id} className={item.checked ? 'item done' : 'item'}>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => update(item, { checked: !item.checked })}
                aria-label={`Mark ${item.name} as ${item.checked ? 'not bought' : 'bought'}`}
              />
              <div className="item-main">
                <span className="item-name">
                  {item.name}
                  {item.qty && <span className="qty"> · {item.qty}</span>}
                </span>
                <span className="muted small">
                  {item.category ?? 'Other'}
                  {item.updatedBy !== userId && ` · edited by ${memberName(item.updatedBy)}`}
                </span>
              </div>
              <select
                className="assignee"
                value={item.assignedTo ?? ''}
                onChange={(e) => update(item, { assignedTo: e.target.value || null })}
                aria-label={`Who's buying ${item.name}`}
              >
                {assigneeOptions}
              </select>
              <button
                type="button"
                className="icon-btn"
                onClick={() => remove(item)}
                aria-label={`Delete ${item.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {live.length > 0 && (
        <footer className="list-footer muted small">
          {doneCount} of {live.length} bought
          {doneCount > 0 && (
            <>
              {' · '}
              <button
                type="button"
                className="link"
                onClick={() => live.filter((i) => i.checked).forEach((i) => remove(i))}
              >
                Clear bought items
              </button>
            </>
          )}
        </footer>
      )}
    </section>
  );
}
