import { test, expect } from '@playwright/test';

test('FEAT-016 v3 cohesive rally composition with zero, one and multiple PECs', async ({ page, request }) => {
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/pecs$/);
  const api = 'http://127.0.0.1:18765/api';
  const headers = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('recce_auth_token'))}` };
  const response = await request.post(`${api}/rallies`, { headers, data: { name: 'Rali Serra Motorsport', year: 2026, surface: 'TERRA', location: 'Serra da Estrela' } }); expect(response.ok()).toBeTruthy();
  const rally = await response.json();
  for (const count of [0, 1, 3]) {
    if (count === 1) expect((await request.post(`${api}/rallies/${rally.id}/pecs`, { headers, data: { name: 'Penhas da Saúde', number: 1, distanceKm: 8.5 } })).ok()).toBeTruthy();
    if (count === 3) for (const [number, name] of [[2, 'Vale do Zêzere'], [3, 'TravessiaDaSerraComUmNomeMuitoLongoSemEspacosParaValidarQuebraDeLinha']] as const) {
      expect((await request.post(`${api}/rallies/${rally.id}/pecs`, { headers, data: { name, number, distanceKm: 4.2 } })).ok()).toBeTruthy();
    }
    await page.goto(`/rally/${rally.id}`); await expect(page.locator('.rally-summary')).toBeVisible();
    const root = page.locator('app-rally-detail'), summary = root.locator('.rally-summary');
    await expect(root.getByRole('article')).toHaveCount(count); await expect(summary.locator('.management-metrics dd').first()).toHaveText(String(count));
    await expect(summary.getByRole('link', { name: 'Ralis & PECs', exact: false })).toBeVisible();
    await expect(root.getByRole('button', { name: 'Adicionar Nova PEC', exact: true })).toHaveCount(1);
    if (!count) await expect(root.getByText('Este rali ainda não tem PECs', { exact: true })).toBeVisible();
    for (const [device, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1000], ['mobile', 360, 800]] as const) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect((await root.locator('.rally-detail-layout').boundingBox())!.width).toBeLessThanOrEqual(1080);
      const band = (await summary.boundingBox())!, list = (await root.locator('section[aria-labelledby="pecs-title"]').boundingBox())!;
      expect(list.y - band.y - band.height).toBeLessThanOrEqual(24);
      for (const card of await root.getByRole('article').all()) expect((await card.boundingBox())!.width).toBeLessThanOrEqual(520);
      for (const control of await root.locator('button, a').all()) if (await control.isVisible()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `../.factory-results/FEAT-016-v3-${count}-${device}.png`, fullPage: true });
    }
  }
  const first = page.getByRole('article', { name: 'Penhas da Saúde', exact: true });
  await expect(first.getByRole('button', { name: 'Editar Penhas da Saúde', exact: true })).toHaveAttribute('title', 'Editar PEC');
  await first.getByRole('button', { name: 'Editar Penhas da Saúde', exact: true }).click();
  await first.getByLabel('Nome', { exact: true }).fill('Penhas revistas');
  const saved = page.waitForResponse(r => /\/pecs\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH');
  await first.getByRole('button', { name: 'Guardar', exact: true }).click(); expect((await saved).ok()).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const updated = page.getByRole('article', { name: 'Penhas revistas', exact: true });
  await updated.getByRole('button', { name: 'Eliminar Penhas revistas', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(updated).toBeVisible();
  await page.locator('.rally-summary').getByRole('link', { name: 'Ralis & PECs', exact: false }).click(); await expect(page).toHaveURL(/\/pecs$/);
});
