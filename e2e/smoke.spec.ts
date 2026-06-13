import { expect, type Page, test } from '@playwright/test';

const ADMIN = { email: 'admin@lla.local', password: 'admin12345' };

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel(/Пароль|Password/).fill(ADMIN.password);
  await page.getByRole('button', { name: /^(Войти|Sign in)$/ }).click();
  await page.waitForURL('**/dashboard');
}

test('login → dashboard shows greeting and stats', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Привет|Hi/);
  // four stat cards
  await expect(page.getByText(/К повторению|Due for review/)).toBeVisible();
});

test('add a vocabulary word → it appears in the deck', async ({ page }) => {
  await login(page);
  await page.goto('/vocabulary');
  const ts = Date.now();
  const lemma = `der Prüfling${ts}`;
  const translation = `проверка-${ts}`;
  await page.getByPlaceholder(/Wort/).fill(lemma);
  await page.getByPlaceholder(/перевод|translation/).fill(translation);
  await page.getByRole('button', { name: /Добавить|Add/ }).click();
  await expect(page.getByText(translation)).toBeVisible();
});

test('SRS review session loads', async ({ page }) => {
  await login(page);
  await page.goto('/vocabulary/review');
  // either the "show answer" button (cards due) or the done screen
  await expect(
    page.getByRole('button', { name: /Показать ответ|Show answer/ }).or(page.getByText(/На сегодня всё|Done for today/)),
  ).toBeVisible();
});

test('admin area loads for an admin', async ({ page }) => {
  await login(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /Админка|Admin/ })).toBeVisible();
  await expect(page.getByText(/AI-запросов|AI requests/)).toBeVisible();
});

test('language switch to English flips the UI', async ({ page }) => {
  await login(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'English' }).click();
  await page.waitForURL('**/settings');
  await page.goto('/dashboard');
  await expect(page.getByText(/keep learning German/)).toBeVisible();
  // restore ru for subsequent runs
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Русский' }).click();
});
