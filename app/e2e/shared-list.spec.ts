import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

// Two test users who are members of the SAME household, and have it open
// as their current list. Set these as environment variables (never commit them).
const userA = { email: process.env.E2E_USER_A_EMAIL, password: process.env.E2E_USER_A_PASSWORD };
const userB = { email: process.env.E2E_USER_B_EMAIL, password: process.env.E2E_USER_B_PASSWORD };

test.skip(
  !userA.email || !userA.password || !userB.email || !userB.password,
  'Set E2E_USER_A_EMAIL, E2E_USER_A_PASSWORD, E2E_USER_B_EMAIL and E2E_USER_B_PASSWORD to run',
);

async function signIn(browser: Browser, email: string, password: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('input[name="username"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByPlaceholder('Add an item…')).toBeVisible();
  return page;
}

async function addItem(page: Page, name: string) {
  await page.getByPlaceholder('Add an item…').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

const row = (page: Page, name: string) => page.locator('li.item', { hasText: name });

test('changes sync live between two people', async ({ browser }) => {
  const a = await signIn(browser, userA.email!, userA.password!);
  const b = await signIn(browser, userB.email!, userB.password!);
  const name = `E2E live ${Date.now()}`;

  await addItem(a, name);
  await expect(row(b, name)).toBeVisible();

  // The app saves to IndexedDB first, so the checkbox updates a moment after
  // the click; a web-first assertion waits for that instead of checking instantly.
  const checkbox = row(b, name).getByRole('checkbox');
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect(row(a, name).getByRole('checkbox')).toBeChecked();

  await a.getByRole('button', { name: `Delete ${name}` }).click();
  await expect(row(b, name)).toHaveCount(0);
});

test('an item added offline syncs after reconnecting', async ({ browser }) => {
  const a = await signIn(browser, userA.email!, userA.password!);
  const b = await signIn(browser, userB.email!, userB.password!);
  const name = `E2E offline ${Date.now()}`;

  await a.context().setOffline(true);
  await expect(a.getByText(/You're offline/)).toBeVisible();

  await addItem(a, name);
  await expect(row(a, name)).toBeVisible(); // saved on the device
  await expect(a.getByText(/1 waiting/)).toBeVisible();
  await expect(row(b, name)).toHaveCount(0); // not on the server yet

  await a.context().setOffline(false);
  await expect(row(b, name)).toBeVisible(); // synced after reconnecting

  await b.getByRole('button', { name: `Delete ${name}` }).click();
  await expect(row(a, name)).toHaveCount(0);
});
