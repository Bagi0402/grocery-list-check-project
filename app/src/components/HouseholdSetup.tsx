import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createHousehold, errorMessage, joinHousehold } from '../api';

type Props = {
  defaultName: string;
  canCancel: boolean;
  onCancel: () => void;
  onDone: (householdId: string) => void | Promise<void>;
  signOut: () => void;
};

export default function HouseholdSetup({ defaultName, canCancel, onCancel, onDone, signOut }: Props) {
  const [displayName, setDisplayName] = useState(defaultName);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The user's name may load after this screen first renders.
  useEffect(() => {
    setDisplayName((current) => current || defaultName);
  }, [defaultName]);

  async function run(validate: () => string, action: () => Promise<string>) {
    const problem = !displayName.trim() ? 'Enter your name first' : validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onDone(await action());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    run(
      () => (householdName.trim() ? '' : 'Enter a name for the list'),
      () => createHousehold(householdName.trim(), displayName.trim()),
    );
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    run(
      () => (inviteCode.trim().length === 8 ? '' : 'Invite codes are 8 characters'),
      () => joinHousehold(inviteCode.trim().toUpperCase(), displayName.trim()),
    );
  }

  return (
    <section className="setup">
      <header className="topbar">
        <h1>Set up a shared list</h1>
        <div className="actions">
          {canCancel && (
            <button type="button" className="link" onClick={onCancel}>
              Back
            </button>
          )}
          <button type="button" className="link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <label className="field">
        <span>Your name (shown to others)</span>
        <input
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setError('');
          }}
          placeholder="e.g. Bagi"
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="setup-grid">
        <form className="card" onSubmit={onCreate}>
          <h2>Start a new list</h2>
          <label className="field">
            <span>List name</span>
            <input
              value={householdName}
              onChange={(e) => {
                setHouseholdName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Our place"
            />
          </label>
          <button type="submit" disabled={busy}>
            Create list
          </button>
        </form>

        <form className="card" onSubmit={onJoin}>
          <h2>Join a friend's list</h2>
          <label className="field">
            <span>Invite code</span>
            <input
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                setError('');
              }}
              placeholder="8 characters"
              autoCapitalize="characters"
              maxLength={8}
            />
          </label>
          <button type="submit" disabled={busy}>
            Join list
          </button>
        </form>
      </div>
    </section>
  );
}
