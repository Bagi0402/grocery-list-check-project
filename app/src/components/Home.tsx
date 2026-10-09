import { useCallback, useEffect, useState } from 'react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { errorMessage, myHouseholds } from '../api';
import type { Membership } from '../api';
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
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(readSelected);
  const [defaultName, setDefaultName] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setMemberships(await myHouseholds());
    } catch (e) {
      setError(errorMessage(e));
      setMemberships([]);
    }
  }, []);

  useEffect(() => {
    load();
    fetchUserAttributes()
      .then((attrs) => setDefaultName(attrs.name ?? attrs.email?.split('@')[0] ?? ''))
      .catch(() => undefined);
  }, [load]);

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
        {error && <p className="banner" role="alert">{error}</p>}
        <HouseholdSetup
          defaultName={defaultName}
          canCancel={Boolean(current)}
          onCancel={() => setShowSetup(false)}
          onDone={async (householdId) => {
            await load();
            select(householdId);
            setShowSetup(false);
          }}
          signOut={signOut}
        />
      </>
    );
  }

  return (
    <ShoppingList
      key={current.householdId}
      userId={userId}
      membership={current}
      memberships={memberships}
      onSwitch={select}
      onAddHousehold={() => setShowSetup(true)}
      signOut={signOut}
    />
  );
}
