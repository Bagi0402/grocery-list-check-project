import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { errorMessage, myHouseholds } from '../api';
import type { Membership } from '../api';
import { MEMBERSHIPS_KEY, openDb, readMeta, writeMeta } from '../offline/db';
import HouseholdSetup from './HouseholdSetup';
import ShoppingList from './ShoppingList';

const STORAGE_KEY = 'grocery.selectedHousehold';

function readSelected(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveSelected(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable (e.g. private mode): selection just isn't remembered.
  }
}

type Props = { userId: string; signOut: () => void };

export default function Home({ userId, signOut }: Props) {
  const db = useMemo(() => openDb(userId), [userId]);

  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(readSelected);
  const [defaultName, setDefaultName] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [error, setError] = useState('');

  // Load from the server when possible; fall back to the copy on this device.
  const load = useCallback(async () => {
    try {
      const fresh = await myHouseholds();
      setMemberships(fresh);
      await writeMeta(db, MEMBERSHIPS_KEY, fresh);
    } catch (e) {
      const cached = await readMeta<Membership[]>(db, MEMBERSHIPS_KEY);
      if (cached) {
        setMemberships(cached);
      } else {
        setError(errorMessage(e));
        setMemberships([]);
      }
    }
  }, [db]);

  useEffect(() => {
    load();
    fetchUserAttributes()
      .then((attrs) => setDefaultName(attrs.name ?? attrs.email?.split('@')[0] ?? ''))
      .catch(() => undefined);
  }, [load]);

  async function handleSignOut() {
    const unsynced = await db.outbox.count();
    if (
      unsynced > 0 &&
      !window.confirm(
        `${unsynced} change${unsynced === 1 ? " hasn't" : "s haven't"} synced yet. Sign out and discard ${unsynced === 1 ? 'it' : 'them'}?`,
      )
    ) {
      return;
    }
    // Remove this user's offline copy so the next person on this device can't see it.
    await db.delete();
    signOut();
  }

  function select(id: string) {
    saveSelected(id);
    setSelectedId(id);
  }

  if (memberships === null) {
    return <p className="center muted">Loading your lists…</p>;
  }

  const current = memberships.find((m) => m.householdId === selectedId) ?? memberships[0];

  if (showSetup || !current) {
    return (
      <>
        {error && (
          <p className="banner" role="alert">
            {error}
          </p>
        )}
        <HouseholdSetup
          defaultName={defaultName}
          canCancel={Boolean(current)}
          onCancel={() => setShowSetup(false)}
          onDone={async (householdId) => {
            await load();
            select(householdId);
            setShowSetup(false);
          }}
          signOut={handleSignOut}
        />
      </>
    );
  }

  return (
    <ShoppingList
      key={current.householdId}
      db={db}
      userId={userId}
      membership={current}
      memberships={memberships}
      onSwitch={select}
      onAddHousehold={() => setShowSetup(true)}
      signOut={handleSignOut}
    />
  );
}
