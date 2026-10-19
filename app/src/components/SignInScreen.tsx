import { Authenticator } from '@aws-amplify/ui-react';
import GroceryScene from './GroceryScene';
import '../signin.css';

// Shown to anyone who isn't signed in: the app's story on the left
// (stacked on top on phones) and the Amplify sign-in card on the right.
export default function SignInScreen() {
  return (
    <div className="signin">
      <section className="signin-intro">
        <p className="signin-brand">
          <img src="/icon-192.png" alt="" width={32} height={32} />
          Shared Grocery List
        </p>
        <h1>Shop together, from one list.</h1>
        <p className="signin-lead">
          Add it at home, tick it off at the shop. Everyone in your household sees the same list as it changes,
          even with no signal.
        </p>
        <GroceryScene />
      </section>

      <section className="signin-panel" aria-label="Sign in or create an account">
        <Authenticator signUpAttributes={['name']} />
      </section>
    </div>
  );
}
