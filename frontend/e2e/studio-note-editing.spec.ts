import { test, expect } from '@playwright/test';

test('FEAT-013 Studio edits one occurrence, persists, prints, cancels and resets without changing the model', async ({ page, request, browser }) => {
  const api = 'http://127.0.0.1:18765/api';
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/pecs$/);
  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  const headers = { Authorization: `Bearer ${token}` };
  const base = { meaning: 'Fixture', attach: 'previous', position: 'center', size: 100, bold: true, underline: false, highlight: false };
  expect((await request.put(`${api}/notebook-preferences`, { headers, data: {
    version: 1, page: { format: 'A4', orientation: 'portrait', marginMm: 12, rowsPerPage: 8, fontPt: 24, separators: true, alignment: 'center' },
    rules: [{ ...base, match: 'E3', display: 'E3', role: 'main' }, { ...base, match: 'ATT', display: 'ATT', role: 'modifier', position: 'bottom-left', size: 70, bold: false }],
  } })).ok()).toBeTruthy();
  const modelBefore = await (await request.get(`${api}/notebook-preferences`, { headers })).text();
  const dictionaryBefore = await (await request.get(`${api}/note-dictionary-rules`, { headers })).text();
  const rally = await (await request.post(`${api}/rallies`, { headers, data: { name: 'Studio note fixture', year: 2026, surface: 'TERRA', location: 'Fixture', status: 'DRAFT' } })).json();
  const pec = await (await request.post(`${api}/rallies/${rally.id}/pecs`, { headers, data: { name: 'Local warnings', number: 1, distanceKm: 1 } })).json();
  const original = { text: 'E3 ATT ATT', originalTimestamp: 5, latitude: 40.1, longitude: -8.1 };
  const first = await (await request.post(`${api}/pecs/${pec.id}/notes`, { headers, data: original })).json();
  const second = await (await request.post(`${api}/pecs/${pec.id}/notes`, { headers, data: { ...original, originalTimestamp: 9 } })).json();
  await page.goto(`/recce/${pec.id}`); await page.getByRole('button', { name: /ST Studio/ }).click();
  const row = page.locator('.note-row').first();
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Texto da nota', { exact: true }).fill('E3 ATT ATT 60');
  await page.getByLabel('Observações da nota', { exact: true }).fill('Atenção específica desta curva');
  await page.getByLabel('Tempo da nota no vídeo (segundos)', { exact: true }).fill('6');
  await row.locator('summary').filter({ hasText: 'Apresentação desta nota' }).click();
  await page.getByLabel('Elemento da nota', { exact: true }).selectOption({ label: 'ATT · ocorrência 2' });
  await page.getByLabel('Posição nesta nota', { exact: true }).selectOption('top-right');
  await page.getByLabel('Tamanho nesta nota (%)', { exact: true }).fill('150');
  await page.getByLabel('Sublinhado nesta nota', { exact: true }).check();
  await page.getByLabel('Destaque nesta nota', { exact: true }).check();
  // Grid positions change DOM order: identify the rendered occurrences by their sizes.
  const untouched = row.locator('app-note-display .note-element[style*="70%"]');
  const customized = row.locator('app-note-display .note-element[style*="150%"]');
  await expect(untouched).toHaveCount(1); await expect(untouched).toHaveText('ATT');
  await expect(untouched).toHaveCSS('text-decoration-line', 'none');
  await expect(customized).toHaveCount(1); await expect(customized).toHaveText('ATT');
  await expect(customized).toHaveCSS('text-decoration-line', 'underline');
  // A failed save must preserve the actual form; the retry uses the real backend.
  await page.route(`**/api/pecs/${pec.id}/notes/${first.id}/align`, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Fixture temporary failure"}' }), { times: 1 });
  await row.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByLabel('Texto da nota', { exact: true })).toHaveValue('E3 ATT ATT 60');
  await expect(row.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled();
  await row.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(row).toContainText('Apresentação personalizada'); await page.reload();
  await page.getByRole('button', { name: /ST Studio/ }).click();
  await expect(row).toContainText('Apresentação personalizada');
  const saved = await (await request.get(`${api}/pecs/${pec.id}/notes`, { headers })).json();
  expect(saved[0]).toMatchObject({ text: 'E3 ATT ATT 60', originalTimestamp: 6, latitude: 40.1, longitude: -8.1, speedRating: 'Atenção específica desta curva' });
  expect(saved[1]).toEqual(second);
  expect(JSON.parse(saved[0].presentationJson).elements).toEqual([expect.objectContaining({ match: 'ATT', occurrence: 1, position: 'top-right', size: 150, underline: true, highlight: true })]);
  await page.getByRole('button', { name: 'Caderno / PDF', exact: true }).click();
  const book = page.locator('app-notebook');
  // The enlarged three-position block legitimately exceeds the default eight-row height.
  await expect(book.getByRole('alert')).toContainText('não cabe');
  await expect(book.getByRole('button', { name: 'Imprimir / Guardar PDF', exact: true })).toBeDisabled();
  expect(await (await request.get(`${api}/notebook-preferences`, { headers })).text()).toBe(modelBefore);
  // Explicit fixture adjustment, equivalent to choosing fewer rows in Configurar notas.
  const roomier = JSON.parse(modelBefore); roomier.page.rowsPerPage = 4;
  expect((await request.put(`${api}/notebook-preferences`, { headers, data: roomier })).ok()).toBeTruthy();
  const adjustedModel = await (await request.get(`${api}/notebook-preferences`, { headers })).text();
  await page.reload(); await page.getByRole('button', { name: /ST Studio/ }).click();
  await page.getByRole('button', { name: 'Caderno / PDF', exact: true }).click();
  const printedStyle = book.locator('.notebook-pages .note-element[style*="150%"]');
  await expect(printedStyle).toHaveCount(1); await expect(printedStyle).toHaveCSS('text-decoration-line', 'underline');
  await page.evaluate(() => {
    const append = document.body.appendChild;
    document.body.appendChild = function<T extends Node>(node: T): T {
      const result = append.call(this, node) as T;
      if (node instanceof HTMLIFrameElement && node.title === 'Caderno para impressão') node.contentWindow!.print = () => {};
      return result;
    };
  });
  await book.getByRole('button', { name: 'Imprimir / Guardar PDF', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Caderno para impressão"]');
  await expect(frame.locator('.note-element[style*="150%"]')).toHaveCount(1);
  const printHtml = await frame.locator('html').evaluate(element => element.outerHTML);
  const context = await browser.newContext(); const pdfPage = await context.newPage(); await pdfPage.setContent(printHtml);
  const pdf = await pdfPage.pdf({ preferCSSPageSize: true, printBackground: true, path: '../.factory-results/FEAT-013-studio-note.pdf' });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-'); await context.close();
  await page.getByRole('button', { name: 'Fechar caderno', exact: true }).click();
  await row.getByRole('button', { name: 'Editar', exact: true }).click();
  await row.locator('summary').click();
  await row.getByRole('button', { name: 'Repor apresentação do modelo', exact: true }).click();
  await row.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(row).toContainText('Apresentação personalizada');
  await row.getByRole('button', { name: 'Editar', exact: true }).click(); await row.locator('summary').click();
  await row.getByRole('button', { name: 'Repor apresentação do modelo', exact: true }).click();
  await row.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(row.getByText('Apresentação personalizada', { exact: true })).toHaveCount(0);
  const reset = await (await request.get(`${api}/pecs/${pec.id}/notes`, { headers })).json();
  expect(reset[0].presentationJson).toBeNull(); expect(reset[1]).toEqual(second);
  expect(await (await request.get(`${api}/notebook-preferences`, { headers })).text()).toBe(adjustedModel);
  expect(await (await request.get(`${api}/note-dictionary-rules`, { headers })).text()).toBe(dictionaryBefore);
  await page.setViewportSize({ width: 390, height: 844 });
  await row.getByRole('button', { name: 'Editar', exact: true }).click(); await row.locator('summary').click();
  const editorBox = await row.locator('.note-edit-panel').boundingBox();
  const rowBox = await row.boundingBox();
  expect(editorBox!.width).toBeGreaterThan(rowBox!.width * .65);
  await page.screenshot({ path: '../.factory-results/FEAT-013-studio-mobile.png', fullPage: true });
});
