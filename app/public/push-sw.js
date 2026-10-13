/* Loaded into the service worker (see workbox.importScripts in vite.config.ts).
   Shows notifications sent by the notify Lambda and opens the app when tapped. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Shared Grocery List', {
      body: data.body || 'Your list was updated',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'grocery-update', // replaces an older notification for the same list
      renotify: true,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
