import { test, expect } from '@playwright/test';

test('FEAT-002 offline entry, Notes disabled, tutorial, direct URLs and new recce remain connected', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/')) apiRequests.push(request.url()); });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Entrar em modo offline', exact: true }).click();
  await expect(page).toHaveURL(/\/offline-recces$/);
  await expect(page.getByRole('heading', { name: 'Reconhecimentos Offline', exact: true })).toBeVisible();
  const notes = page.locator('aside').getByRole('link', { name: 'Notas', exact: true });
  await expect(notes).toBeVisible();
  await expect(notes).toHaveAttribute('aria-disabled', 'true');
  await expect(notes).toHaveAttribute('tabindex', '-1');
  await expect(notes).not.toHaveAttribute('href');
  await page.getByRole('link', { name: 'Reconhecimentos Offline', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(notes).not.toBeFocused();
  await notes.dispatchEvent('click');
  await expect(page).toHaveURL(/\/offline-recces$/);

  await page.getByRole('link', { name: 'Tutorial', exact: true }).click();
  await expect(page).toHaveURL(/\/tutorial$/);
  await page.getByRole('link', { name: 'Reconhecimentos Offline', exact: true }).click();
  await page.getByRole('button', { name: 'Novo reconhecimento', exact: true }).first().click();
  await expect(page).toHaveURL(/\/recce-mode$/);
  await page.getByRole('link', { name: 'Reconhecimentos Offline', exact: true }).click();

  await page.goto('/notes?from=bookmark');
  await expect(page).toHaveURL(/\/offline-recces$/);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/offline-recces$/);
  expect(apiRequests, 'The offline journey must not access the backend').toEqual([]);
});

test('FEAT-002 switching an authenticated user to offline opens the list and disables Notes', async ({ page }) => {
  const password = process.env['RECCE_E2E_PASSWORD'];
  if (!password) throw new Error('Missing ephemeral fixture password');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/pecs$/);
  const notes = page.locator('aside').getByRole('link', { name: 'Notas', exact: true });
  await expect(notes).toHaveAttribute('href', '/notes');
  await expect(notes).not.toHaveAttribute('aria-disabled');
  await page.locator('aside .connection-toggle').click();
  await expect(page).toHaveURL(/\/offline-recces$/);
  await expect(notes).toHaveAttribute('aria-disabled', 'true');
  await expect(notes).not.toHaveAttribute('href');
  await page.locator('aside .connection-toggle').click();
  await expect(notes).toHaveAttribute('href', '/notes');
  await expect(notes).not.toHaveAttribute('aria-disabled');
});
