import { deletePushSubscription, savePushSubscription } from './api';

// Public half of the VAPID key pair (safe to ship in the app).
const PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY || undefined;

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// VAPID keys are base64url text; the browser wants raw bytes.
function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// Short, fixed-length id for a subscription (endpoints are long URLs).
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function getPushState(): Promise<PushState> {
  if (!PUBLIC_KEY) return 'unsupported';
  if (!pushSupported()) {
    // iPhone/iPad only allow web push for apps added to the Home Screen.
    return isIos() && !isInstalled() ? 'needs-install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

// Ask permission (first time only), subscribe this device and register it.
export async function enablePush(): Promise<void> {
  if (!PUBLIC_KEY) throw new Error('Notifications are not set up for this app yet.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed.');

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(PUBLIC_KEY),
    }));

  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys.auth) throw new Error('The browser returned an incomplete subscription.');

  await savePushSubscription({
    endpointHash: await sha256Hex(subscription.endpoint),
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });
}

// Stop notifications on this device.
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  try {
    await deletePushSubscription(await sha256Hex(subscription.endpoint));
  } finally {
    await subscription.unsubscribe();
  }
}
