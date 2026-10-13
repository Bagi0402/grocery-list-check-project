import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { disablePush, enablePush, getPushState } from '../push';
import type { PushState } from '../push';
import { useOnline } from '../offline/useOnline';

export default function NotificationToggle() {
  const online = useOnline();
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPushState()
      .then((s) => {
        if (cancelled) return;
        setState(s);
        // Re-register quietly: browsers sometimes rotate subscriptions, and
        // this also links the device to whoever is signed in now.
        if (s === 'on' && navigator.onLine) enablePush().catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setState('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    setBusy(true);
    setMessage('');
    try {
      if (state === 'on') {
        await disablePush();
        setState('off');
      } else {
        await enablePush();
        setState('on');
      }
    } catch (e) {
      setMessage(errorMessage(e));
      setState(await getPushState().catch((): PushState => 'unsupported'));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading' || state === 'unsupported') return null;

  if (state === 'needs-install') {
    return (
      <p className="muted small">
        To get notifications on iPhone, add this app to your Home Screen (Share → Add to Home Screen) and open it
        from there.
      </p>
    );
  }

  if (state === 'denied') {
    return (
      <p className="muted small">
        Notifications are blocked for this site. Allow them in your browser or phone settings to turn them on.
      </p>
    );
  }

  return (
    <p className="muted small">
      Notifications: {state === 'on' ? 'on' : 'off'}
      {' · '}
      <button type="button" className="link" onClick={toggle} disabled={busy || !online}>
        {state === 'on' ? 'Turn off' : 'Turn on'}
      </button>
      {message && <span className="error"> {message}</span>}
    </p>
  );
}
