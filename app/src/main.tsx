import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import './offline.css';
import { configureAmplify } from './config';
import App from './App';

configureAmplify();

// Ask the browser not to clear this app's offline data when storage is low.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
