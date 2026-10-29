import { test, expect, Locator } from '@playwright/test';

test('FEAT-014 clear media actions, visible exports, readonly states and safe deletion', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/pecs$/);
  const api = 'http://127.0.0.1:18765/api';
  const headers = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('recce_auth_token'))}` };
  const rally = await (await request.post(`${api}/rallies`, { headers, data: { name: 'Control hierarchy', year: 2026, surface: 'TERRA', location: 'Serra' } })).json();
  const pec = await (await request.post(`${api}/rallies/${rally.id}/pecs`, { headers, data: { name: 'Ficheiros e exportação', number: 1, distanceKm: 1 } })).json();
  expect((await request.post(`${api}/pecs/${pec.id}/notes`, { headers, data: { text: 'D6 ATT', originalTimestamp: 1 } })).ok()).toBeTruthy();
  const wav = Buffer.alloc(1644); wav.write('RIFF'); wav.writeUInt32LE(1636, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(1600, 40);
  const audioResponse = await request.post(`${api}/pecs/${pec.id}/audio`, { headers, multipart: { file: { name: 'recce-audio.wav', mimeType: 'audio/wav', buffer: wav } } });
  expect(audioResponse.ok()).toBeTruthy(); const audioAssets = await audioResponse.json();
  await page.goto(`/recce/${pec.id}`); await page.getByRole('button', { name: 'Studio', exact: true }).click();
  const files = page.locator('.studio-tools > details').filter({ has: page.locator('summary', { hasText: /^Ficheiros$/ }) });
  const panel = files.locator('[popover]'), assets = panel.locator('app-studio-assets');
  const exportPdf = page.getByRole('button', { name: 'Exportar PDF', exact: true });
  async function contrast(control: Locator) {
    return control.evaluate(node => {
      const style = getComputedStyle(node), lum = (color: string) => color.match(/\d+/g)!.slice(0, 3).map(value => { const c = Number(value) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
      const a = lum(style.color), b = lum(style.backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
  }
  await expect(exportPdf).toBeVisible(); await expect(exportPdf.locator('svg')).toHaveAttribute('aria-hidden', 'true'); expect(await contrast(exportPdf)).toBeGreaterThanOrEqual(4.5);
  await files.locator('summary').click();
  await expect(assets.getByLabel('Adicionar vídeo', { exact: true })).toBeEnabled();
  await expect(assets.getByLabel('Substituir áudio', { exact: true })).toBeEnabled();
  await expect(assets).toContainText(audioAssets.audioFileName);
  const danger = assets.getByRole('button', { name: 'Eliminar áudio', exact: true });
  await expect(danger.locator('svg')).toHaveCount(1); await expect(danger).toHaveCSS('background-color', 'rgb(76, 21, 37)'); expect(await contrast(danger)).toBeGreaterThanOrEqual(4.5);
  await assets.getByLabel('Substituir áudio', { exact: true }).focus();
  await expect(assets.getByLabel('Substituir áudio', { exact: true }).locator('..')).toHaveCSS('outline-width', '3px');
  const download = page.waitForEvent('download'); await assets.getByRole('button', { name: 'Exportar notas em Excel', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/); await expect(panel).toBeHidden();
  await exportPdf.click(); await expect(page.getByRole('dialog', { name: 'Caderno / PDF' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimir / Guardar PDF', exact: true })).toBeEnabled(); await page.keyboard.press('Escape');
  await files.locator('summary').click(); await danger.click();
  await expect(page.getByRole('dialog', { name: 'Eliminar áudio', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect((await (await request.get(`${api}/pecs/${pec.id}/assets`, { headers })).json()).hasAudio).toBeTruthy();
  await files.locator('summary').click(); await page.screenshot({ path: '../.factory-results/FEAT-014-controls-desktop.png', animations: 'disabled' }); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 360, height: 800 }); await files.locator('summary').click();
  for (const label of await assets.locator('.asset-picker').all()) { const box = (await label.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.x + box.width).toBeLessThanOrEqual(360); }
  await page.screenshot({ path: '../.factory-results/FEAT-014-controls-mobile.png', animations: 'disabled' });
  await panel.evaluate(node => { node.scrollTop = node.scrollHeight; }); await page.keyboard.press('Escape'); await files.locator('summary').click();
  expect(await panel.evaluate(node => node.scrollTop)).toBe(0); await page.keyboard.press('Escape');
  expect((await request.patch(`${api}/pecs/${pec.id}`, { headers, data: { status: 'COMPLETED' } })).ok()).toBeTruthy();
  await page.reload(); await page.getByRole('button', { name: 'Studio', exact: true }).click(); await files.locator('summary').click();
  await expect(danger).toBeDisabled(); for (const input of await assets.locator('input').all()) await expect(input).toBeDisabled();
  await expect(assets.getByRole('button', { name: 'Exportar notas em Excel', exact: true })).toBeEnabled(); await page.keyboard.press('Escape'); await expect(exportPdf).toBeEnabled();
  expect((await request.patch(`${api}/pecs/${pec.id}`, { headers, data: { status: 'DRAFT' } })).ok()).toBeTruthy();
  await page.reload(); await page.getByRole('button', { name: 'Studio', exact: true }).click(); await files.locator('summary').click();
  await danger.click(); const deleted = page.waitForResponse(response => response.url() === `${api}/pecs/${pec.id}/audio` && response.request().method() === 'DELETE');
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click(); expect((await deleted).ok()).toBeTruthy();
  await files.locator('summary').click(); await expect(assets.getByLabel('Adicionar áudio', { exact: true })).toBeEnabled(); await expect(danger).toHaveCount(0);
  expect((await (await request.get(`${api}/pecs/${pec.id}/notes`, { headers })).json())).toHaveLength(1);
});
