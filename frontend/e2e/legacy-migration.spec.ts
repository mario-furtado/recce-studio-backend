import { test, expect } from '@playwright/test';

test('FEAT-020 migrated owner retains old rally/PEC URLs, media and revocable sessions', async ({ page, request }) => {
  const api = 'http://127.0.0.1:18765/api', password = process.env['RECCE_E2E_PASSWORD']!;
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill('migrated@e2e.invalid'); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/pecs$/);
  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  await expect(page.getByRole('article', { name: 'Rali legado FEAT020', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Rali legado FEAT020', exact: true }).click();
  await expect(page.getByRole('article', { name: 'PEC legada FEAT020', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Continuar reconhecimento', exact: true }).click(); await expect(page).toHaveURL(/\/recce\/legacy-e2e-pec$/);
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rever nota 1: E3 legado', exact: true })).toBeVisible();
  const media = await request.get(`${api}/pecs/legacy-e2e-pec/audio`, { headers: { Authorization: `Bearer ${token}` } }); expect(media.status()).toBe(200); expect((await media.body()).length).toBe(60);
  const other = await (await request.post(`${api}/auth/login`, { data: { email: 'other@e2e.invalid', password } })).json();
  expect((await request.get(`${api}/pecs/legacy-e2e-pec/audio`, { headers: { Authorization: `Bearer ${other.token}` } })).status()).toBe(404);
  await page.screenshot({ path: '../.factory-results/FEAT-020-legacy-studio.png', fullPage: true });
  await page.locator('aside.app-sidebar').getByRole('button', { name: 'Logout', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  expect((await request.get(`${api}/auth/validate`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
  await page.getByLabel('Email', { exact: true }).fill('migrated@e2e.invalid'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/pecs$/); await expect(page.getByRole('article', { name: 'Rali legado FEAT020', exact: true })).toBeVisible();
});
