import { test, expect } from '@playwright/test';

test('FEAT-004 personal dictionary persists and the Studio exports the measured notebook without losing warnings', async ({ page, request, browser }) => {
  const password = process.env['RECCE_E2E_PASSWORD'];
  if (!password) throw new Error('Missing ephemeral fixture password');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/pecs$/);
  await page.goto('/notes');
  const dictionaryForm = page.locator('app-notes form');
  await dictionaryForm.getByLabel(/Quando digo/i).fill('mais mais do caderno');
  await dictionaryForm.getByLabel(/Escrever/i).fill('++');
  await dictionaryForm.getByLabel(/Significado/i).fill('Definido pela equipa');
  const dictionaryWrite = page.waitForResponse(response => response.url().endsWith('/api/note-dictionary-rules') && response.request().method() === 'POST');
  await dictionaryForm.getByRole('button', { name: 'Adicionar', exact: true }).click();
  expect((await dictionaryWrite).ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Caderno e exportação', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardar modelo pessoal' })).toBeEnabled();
  await page.getByLabel('Formato', { exact: true }).selectOption('A5');
  await page.getByLabel('Orientação', { exact: true }).selectOption('landscape');
  await page.getByLabel('Margens (mm)', { exact: true }).fill('10');
  await page.getByLabel('Linhas por página', { exact: true }).fill('3');
  await page.getByLabel('Letra (pt)', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Apresentação', exact: true }).click();
  await page.getByLabel('Símbolo do Dicionário', { exact: true }).selectOption('++');
  const modifier = page.locator('details').filter({ has: page.locator('summary', { hasText: /^\+\+ →/ }) });
  await modifier.getByLabel('Posição', { exact: true }).selectOption('top-left');
  await expect(modifier.getByLabel('Significado', { exact: true })).toHaveValue('Definido pela equipa');
  await expect(modifier.getByLabel('Significado', { exact: true })).toHaveAttribute('readonly', '');
  await modifier.getByLabel('Sublinhado', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar modelo pessoal', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Modelo pessoal guardado');
  await page.reload();
  await page.getByRole('button', { name: 'Caderno e exportação', exact: true }).click();
  await expect(page.getByLabel('Formato', { exact: true })).toHaveValue('A5');
  await expect(page.getByLabel('Orientação', { exact: true })).toHaveValue('landscape');
  await page.getByRole('button', { name: 'Apresentação', exact: true }).click();
  await page.getByLabel('Símbolo do Dicionário', { exact: true }).selectOption('++');
  await expect(modifier.getByLabel('Posição', { exact: true })).toHaveValue('top-left');
  await expect(modifier.getByLabel('Sublinhado', { exact: true })).toBeChecked();

  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  const headers = { Authorization: `Bearer ${token}` };
  const api = 'http://127.0.0.1:18765/api';
  const rallyResponse = await request.post(`${api}/rallies`, { headers, data: { name: 'Notebook fixture', year: 2026, surface: 'TERRA', location: 'Fixture', status: 'DRAFT' } });
  expect(rallyResponse.ok(), await rallyResponse.text()).toBeTruthy();
  const rally = await rallyResponse.json();
  const pecResponse = await request.post(`${api}/rallies/${rally.id}/pecs`, { headers, data: { name: 'Notebook PEC', number: 1, distanceKm: 1 } });
  expect(pecResponse.ok()).toBeTruthy();
  const pec = await pecResponse.json();
  const sequence = 'D6 > E3 60 ATT E1 NC '.repeat(12).trim();
  const original = [
    { text: 'E6++ nt', speedRating: 'Aviso preservado', originalTimestamp: 1 },
    { text: sequence, speedRating: 'Última observação', originalTimestamp: 3 },
  ];
  for (const note of original) expect((await request.post(`${api}/pecs/${pec.id}/notes`, { headers, data: note })).ok()).toBeTruthy();
  await page.goto(`/recce/${pec.id}`);
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  const noteElement = page.locator('app-note-display .note-element').filter({ hasText: /^\+\+$/ }).first();
  await expect(noteElement).toHaveCSS('text-decoration-line', 'underline');
  await expect(noteElement.locator('..')).toHaveCSS('grid-area', '1 / 1');
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const notebook = page.locator('app-notebook');
  await expect(notebook.getByRole('button', { name: 'Imprimir / Guardar PDF', exact: true })).toBeEnabled();
  const pages = notebook.locator('.notebook-page');
  expect(await pages.count()).toBeGreaterThan(2);
  await expect(notebook.locator('.notebook-pages')).toContainText('Última');
  const checks = await notebook.locator('.notebook-pages').evaluate(root => {
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.notebook-row'));
    return {
      nc: Array.from(root.querySelectorAll('.note-element')).filter(element => element.textContent?.trim() === 'NC').length,
      att: Array.from(root.querySelectorAll('.note-element')).filter(element => element.textContent?.trim() === 'ATT').length,
      overflow: rows.some(row => Array.from(row.querySelectorAll('.note-block')).some(block => {
        const a = row.getBoundingClientRect(), b = block.getBoundingClientRect();
        return b.right > a.right + 1 || b.bottom > a.bottom + 1 || b.top < a.top - 1;
      })),
    };
  });
  expect(checks).toEqual({ nc: 12, att: 12, overflow: false });
  await page.screenshot({ path: '../.factory-results/FEAT-004-notebook.png', fullPage: true });

  // Capture the actual print document; suppress only the native dialog in automated Chromium.
  await page.evaluate(() => {
    const append = document.body.appendChild;
    document.body.appendChild = function<T extends Node>(node: T): T {
      const result = append.call(this, node) as T;
      if (node instanceof HTMLIFrameElement && node.title === 'Caderno para impressão') node.contentWindow!.print = () => {};
      return result;
    };
  });
  await notebook.getByRole('button', { name: 'Imprimir / Guardar PDF', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Caderno para impressão"]');
  await expect(frame.locator('.notebook-page')).toHaveCount(await pages.count());
  await expect(frame.locator('button')).toHaveCount(0);
  const printHtml = await frame.locator('html').evaluate(element => element.outerHTML);
  const context = await browser.newContext();
  const pdfPage = await context.newPage();
  await pdfPage.setContent(printHtml);
  const pdf = await pdfPage.pdf({ preferCSSPageSize: true, printBackground: true, path: '../.factory-results/FEAT-004-notebook.pdf' });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const pdfText = pdf.toString('latin1');
  expect((pdfText.match(/\/Type \/Page\b/g) || []).length).toBe(await pages.count());
  const mediaBox = /\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdfText);
  expect(mediaBox).not.toBeNull();
  expect(Math.abs(Number(mediaBox![1]) - 210 / 25.4 * 72)).toBeLessThan(1);
  expect(Math.abs(Number(mediaBox![2]) - 148 / 25.4 * 72)).toBeLessThan(1);
  await context.close();
  const saved = await (await request.get(`${api}/pecs/${pec.id}/notes`, { headers })).json();
  expect(saved.map((note: {text: string; speedRating: string; originalTimestamp: number}) => ({ text: note.text, speedRating: note.speedRating, originalTimestamp: note.originalTimestamp }))).toEqual(original);
  await page.getByRole('button', { name: 'Fechar caderno', exact: true }).click();
  await page.locator('.desktop-options > summary').click();
  await page.getByRole('link', { name: 'Configurar notas', exact: true }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByRole('heading', { name: 'Configurar notas', exact: true })).toBeVisible();
});

test('FEAT-004 invalid configuration and oversized content block printing with an explicit explanation', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/pecs$/);
  await page.goto('/notes');
  await page.getByRole('button', { name: 'Caderno e exportação', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardar modelo pessoal' })).toBeEnabled();
  await page.getByLabel('Linhas por página', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Guardar modelo pessoal', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('Página inválida');
  await page.getByLabel('Linhas por página', { exact: true }).fill('8');
  await page.getByLabel('Texto para pré-visualização', { exact: true }).fill('X'.repeat(500));
  await expect(page.locator('app-notebook').getByRole('alert')).toContainText('não cabe');
  await expect(page.locator('app-notebook').getByRole('button', { name: 'Imprimir / Guardar PDF' })).toBeDisabled();
});
