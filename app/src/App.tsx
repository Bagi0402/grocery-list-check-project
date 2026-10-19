import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import Home from './components/Home';
import SignInScreen from './components/SignInScreen';

// Decides what to show based on whether someone is signed in.
function Gate() {
  const { authStatus, user, signOut } = useAuthenticator((context) => [context.authStatus, context.user]);

  if (authStatus === 'configuring') {
    return <p className="center muted">Loading…</p>;
  }

  if (authStatus !== 'authenticated' || !user) {
    return <SignInScreen />;
  }

  return (
    <main className="shell">
      <Home userId={user.userId} signOut={() => signOut()} />
    </main>
  );
}

export default function App() {
  return (
    <Authenticator.Provider>
      <Gate />
    </Authenticator.Provider>
  );
}
