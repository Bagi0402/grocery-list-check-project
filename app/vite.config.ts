import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Service worker: caches the app so it opens with no connection,
    // and a web manifest so phones can install it to the home screen.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Shared Grocery List',
        short_name: 'Groceries',
        description: 'A shared grocery list that syncs live and works offline.',
        theme_color: '#1f7a4d',
        background_color: '#f6f7f4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: '/index.html',
        // Adds the push-notification handlers from public/push-sw.js.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
});
