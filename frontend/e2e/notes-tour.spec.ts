import { test, expect } from '@playwright/test';

test('FEAT-006 guided notes tour preserves real data, highlights targets and works with keyboard on mobile', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/pecs$/);
  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  const headers = { Authorization: `Bearer ${token}` };
  const api = 'http://127.0.0.1:18765/api';
  async function persisted() {
    return Promise.all(['note-dictionary-rules', 'notebook-preferences', 'team-profile'].map(async path => {
      const response = await request.get(`${api}/${path}`, { headers });
      expect(response.ok()).toBeTruthy();
      return response.text();
    }));
  }
  const before = await persisted();
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  const writes: string[] = [];
  page.on('request', req => { if (req.url().startsWith(api) && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) writes.push(`${req.method()} ${req.url()}`); });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('link', { name: 'Tutorial', exact: true }).click();
  await page.getByRole('link', { name: 'Aprender a configurar notas', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Passo 1 de 12');
  await expect(page.locator('.tour-spotlight')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Próximo passo', exact: true }).click();
  await expect(page).toHaveURL(/\/notes\/learn$/);
  for (let step = 2; step <= 12; step++) {
    await expect(dialog).toContainText(`Passo ${step} de 12`);
    await expect(page.locator('#tour-title')).toBeFocused();
    await expect(page.locator('.tour-spotlight')).toBeVisible();
    if (step === 4) await expect(page.locator('app-notes input[name="phrase"]')).toHaveValue('esquerda exemplo');
    if (step === 5) await expect(page.locator('.note-rule-row')).toContainText('E6');
    if (step === 7) await expect(page.locator('app-notebook-settings details[open] select[aria-label="Posição"]')).toHaveValue('top-right');
    if (step === 9) await expect(page.locator('app-notebook-settings').getByLabel('Linhas por página', { exact: true })).toHaveValue('6');
    if (step === 10) {
      await expect(page.locator('app-notebook-settings app-notebook [role="alert"]')).toBeVisible();
      await expect(page.locator('app-notebook-settings app-notebook button')).toBeDisabled();
      await page.screenshot({ path: '../.factory-results/FEAT-006-overflow.png', fullPage: false });
    }
    if (step === 12) {
      await expect(page.locator('[data-tour="studio-example"] .notebook-pages')).toContainText('E6');
      await expect(page.locator('[data-tour="studio-example"] app-notebook [role="alert"]')).toHaveCount(0);
      await page.screenshot({ path: '../.factory-results/FEAT-006-desktop.png', fullPage: false });
    } else await dialog.getByRole('button', { name: 'Próximo passo', exact: true }).click();
  }
  await dialog.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(dialog).toContainText('Passo 11 de 12');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/tutorial$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'Rever apresentação', exact: true }).click();
  await expect(dialog).toContainText('Passo 1 de 3');
  await dialog.getByRole('button', { name: 'Próximo passo', exact: true }).click();
  await expect(dialog).toContainText('Passo 2 de 3');
  await expect(page.locator('app-notebook-settings details[open] select[aria-label="Posição"]')).toBeInViewport();
  await page.screenshot({ path: '../.factory-results/FEAT-006-mobile-modifier.png', fullPage: false });
  await page.reload();
  await expect(dialog).toContainText('Passo 1 de 3');
  await expect(page.locator('.tour-spotlight')).toBeVisible();
  const box = await page.locator('.tour-panel').boundingBox();
  expect(box).toBeTruthy(); expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  for (let tab = 0; tab < 8; tab++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBeTruthy();
  }
  await page.screenshot({ path: '../.factory-results/FEAT-006-mobile.png', fullPage: false });
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/tutorial$/);
  expect(writes).toEqual([]);
  expect(await persisted()).toEqual(before);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storage);
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('link', { name: 'Notas', exact: true }).click();
  await page.locator('app-notes .notes-help > summary').click();
  await page.getByRole('link', { name: 'Mostrar ajuda guiada', exact: true }).click();
  await expect(dialog).toContainText('Passo 1 de 12');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Rever Studio e PDF', exact: true }).click();
  await expect(dialog).toContainText('Passo 1 de 2');
  await dialog.getByRole('button', { name: 'Próximo passo', exact: true }).click();
  await dialog.getByRole('button', { name: 'Experimentar com as minhas notas', exact: true }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByRole('heading', { name: 'Configurar notas', exact: true })).toBeVisible();
});
