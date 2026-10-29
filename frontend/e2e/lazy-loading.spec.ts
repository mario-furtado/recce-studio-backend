import { test, expect } from '@playwright/test';

test('AUD-PERF-001 feature chunks load on SPA navigation and are reused on return', async ({ page }) => {
  const password = process.env['RECCE_E2E_PASSWORD'];
  if (!password) throw new Error('Missing ephemeral fixture password');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(password);
  const rallies = page.waitForResponse(r => r.url().endsWith('/api/rallies') && r.request().method() === 'GET');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  expect((await rallies).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Ralis & PECs' })).toBeVisible();

  const scripts: string[] = [];
  let documents = 0;
  page.on('request', request => { if (request.resourceType() === 'document') documents++; });
  page.on('response', response => {
    if (response.request().resourceType() === 'script' && response.url().startsWith('http://127.0.0.1:18766/')) {
      expect(response.status()).toBe(200);
      scripts.push(response.url());
    }
  });
  await page.getByRole('link', { name: 'Perfil da Equipa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E2E owner', exact: true })).toBeVisible();
  expect(scripts.length, 'First visit must fetch a deferred feature chunk').toBeGreaterThan(0);
  const afterProfile = scripts.length;
  await page.getByRole('link', { name: 'Configuracoes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
  expect(scripts.length, 'A different feature must load its own chunk').toBeGreaterThan(afterProfile);
  const afterSettings = scripts.length;
  await page.getByRole('link', { name: 'Perfil da Equipa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E2E owner', exact: true })).toBeVisible();
  expect(scripts.length, 'Returning must reuse the already loaded component').toBe(afterSettings);
  expect(documents, 'Feature navigation must not reload the document').toBe(0);
});
