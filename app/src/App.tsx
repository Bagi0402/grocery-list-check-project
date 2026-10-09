import { Authenticator } from '@aws-amplify/ui-react';
import Home from './components/Home';

// Authenticator renders sign-in / sign-up / verify-email screens,
// then shows the app once the user is signed in.
export default function App() {
  return (
    <main className="shell">
      <Authenticator signUpAttributes={['name']}>
        {({ signOut, user }) =>
          user ? <Home userId={user.userId} signOut={() => signOut?.()} /> : <></>
        }
      </Authenticator>
    </main>
  );
}
