import { test, expect } from '@playwright/test';

test('FEAT-015 compact team dashboard preserves profile, garage, photos and real activity', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/pecs$/);
  const api = 'http://127.0.0.1:18765/api', headers = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('recce_auth_token'))}` };
  const before = await (await request.get(`${api}/team-profile`, { headers })).json();
  const rallyResponse = await request.post(`${api}/rallies`, { headers, data: { name: 'Rali da Serra', year: 2026, surface: 'TERRA', location: 'Serra' } }); expect(rallyResponse.ok()).toBeTruthy();
  const rally = await rallyResponse.json();
  const pecResponse = await request.post(`${api}/rallies/${rally.id}/pecs`, { headers, data: { name: 'Serra da Estrela', number: 1, distanceKm: 8.5 } }); expect(pecResponse.ok()).toBeTruthy();
  const pec = await pecResponse.json();
  await page.goto('/team-profile'); const root = page.locator('app-team-profile');
  const editProfile = page.getByRole('button', { name: 'Editar Perfil', exact: true });
  await editProfile.focus(); await expect(editProfile).toHaveCSS('outline-width', '3px');
  await page.keyboard.press('Enter');
  await page.getByLabel('Nome da equipa', { exact: true }).fill('Equipa Serra Motorsport');
  await page.getByLabel('Piloto', { exact: true }).fill('Ana Silva'); await page.getByLabel('Navegador', { exact: true }).fill('Rui Santos');
  await page.getByLabel('Unidade de Medida', { exact: true }).selectOption('Milhas (mi)');
  const saved = page.waitForResponse(r => r.url() === `${api}/team-profile` && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click(); expect((await saved).ok()).toBeTruthy();
  expect((await (await request.get(`${api}/team-profile`, { headers })).json()).noteSystem).toBe(before.noteSystem);
  await expect(page.getByRole('heading', { name: 'Equipa Serra Motorsport', exact: true })).toBeVisible();
  await expect(root.locator('.team-header')).toContainText('Ana Silva'); await expect(root.locator('.team-header')).toContainText('Rui Santos');
  expect((await root.locator('.team-header').boundingBox())!.height).toBeLessThan(150);
  await expect(root.locator('.team-metrics')).toContainText('km em recce');
  await expect(root.locator('#team-distance-unit')).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar Perfil', exact: true }).click();
  await expect(page.getByLabel('Unidade de Medida', { exact: true })).toHaveValue('Milhas (mi)');
  await page.getByLabel('Nome do carro', { exact: true }).fill('Skoda Fabia RS Rally2');
  const created = page.waitForResponse(r => r.url() === `${api}/team-profile/cars` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar Carro', exact: true }).click(); const car = await (await created).json();
  let row = root.getByRole('article', { name: 'Skoda Fabia RS Rally2', exact: true });
  await row.getByRole('button', { name: 'Editar Skoda Fabia RS Rally2', exact: true }).click();
  await page.getByLabel('Notas do carro', { exact: true }).fill('Setup de terra');
  const edited = page.waitForResponse(r => r.url() === `${api}/team-profile/cars/${car.id}` && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Guardar Carro', exact: true }).click(); expect((await edited).ok()).toBeTruthy();
  await row.getByRole('button', { name: 'Selecionar Skoda Fabia RS Rally2', exact: true }).click();
  await expect(row).toContainText('Viatura ativa'); await expect(root.locator('article').first()).toHaveAttribute('aria-label', 'Skoda Fabia RS Rally2');
  // Valid image uploaded to the actual authenticated photo endpoint.
  const photo = page.waitForResponse(r => r.url() === `${api}/team-profile/cars/${car.id}/photo` && r.request().method() === 'POST');
  await row.getByLabel('Foto de Skoda Fabia RS Rally2', { exact: true }).setInputFiles({ name: 'car.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1eYAAAAASUVORK5CYII=', 'base64') });
  expect((await photo).ok()).toBeTruthy();
  await expect(row.getByRole('img', { name: 'Fotografia de Skoda Fabia RS Rally2' })).toBeVisible();
  await expect.poll(() => row.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  // The isolated suite shares this account across scenarios. Same-day updates can
  // legitimately put this scenario's PEC outside the five-item limit.
  const availableRallies = await (await request.get(`${api}/rallies`, { headers })).json();
  const actualPecs: { id: string; name: string; updatedAt: string }[] = [];
  for (const available of availableRallies) {
    const response = await request.get(`${api}/rallies/${available.id}/pecs`, { headers }); expect(response.ok()).toBeTruthy();
    actualPecs.push(...await response.json());
  }
  expect(actualPecs.some(item => item.id === pec.id)).toBeTruthy();
  const expectedRecent = actualPecs.filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.updatedAt))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).slice(0, 5);
  const activity = root.locator('.activity-list'); await expect(activity.getByRole('link')).toHaveCount(expectedRecent.length);
  for (const [index, expectedPec] of expectedRecent.entries()) {
    await expect(activity.getByRole('link').nth(index)).toHaveAttribute('href', `/recce/${expectedPec.id}`);
    await expect(activity.getByRole('link').nth(index)).toContainText(expectedPec.name);
  }
  await page.screenshot({ path: '../.factory-results/FEAT-015-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: '../.factory-results/FEAT-015-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole('button', { name: 'Editar Perfil', exact: true }).click();
  await page.getByLabel('Nome da equipa', { exact: true }).fill('EquipaComUmNomeMuitoLongoSemEspacosParaVerificarResponsividadeNaEdicao');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  for (const button of await root.locator('button, .file-picker').all()) {
    if (await button.isVisible()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Equipa Serra Motorsport', exact: true })).toBeVisible();
  row = root.getByRole('article', { name: 'Skoda Fabia RS Rally2', exact: true }); await expect(row).toContainText('Viatura ativa');
  await page.getByRole('button', { name: 'Editar Perfil', exact: true }).click();
  await row.getByRole('button', { name: 'Eliminar Skoda Fabia RS Rally2', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Eliminar Skoda Fabia RS Rally2', exact: true }).click();
  const deleted = page.waitForResponse(r => r.url() === `${api}/team-profile/cars/${car.id}` && r.request().method() === 'DELETE');
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click(); expect((await deleted).ok()).toBeTruthy();
  await expect(row).toHaveCount(0);
});
