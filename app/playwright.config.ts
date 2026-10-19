import { defineConfig, devices } from '@playwright/test';

// End-to-end tests drive two real browser sessions against a running app.
// Default target is `npm run preview`; set E2E_BASE_URL to test the live site.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
});
