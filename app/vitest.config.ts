import { defineConfig } from 'vitest/config';

// Unit tests run in Node with an in-memory IndexedDB (fake-indexeddb),
// so the real Dexie database code is exercised without a browser.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
  },
});
