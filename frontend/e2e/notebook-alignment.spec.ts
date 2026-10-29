import { test, expect } from '@playwright/test';

test('FEAT-009 legacy notebooks center by default, alignment persists and exports to real PDF', async ({ page, request, browser }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/pecs$/);
  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  const headers = { Authorization: `Bearer ${token}` };
  const api = 'http://127.0.0.1:18765/api/notebook-preferences';
  const old = await request.get(api, { headers });
  expect([200, 204]).toContain(old.status());
  if (old.status() === 200) {
    const legacy = await old.json(); delete legacy.page.alignment;
    expect((await request.put(api, { headers, data: legacy })).ok()).toBeTruthy();
  }
  await page.getByRole('link', { name: 'Notas', exact: true }).click();
  await page.getByRole('button', { name: 'Caderno e exportação', exact: true }).click();
  const personal = page.locator('app-notebook-settings');
  const alignment = personal.getByLabel('Alinhamento das notas', { exact: true });
  await expect(alignment).toHaveValue('center');
  await personal.getByLabel('Formato', { exact: true }).selectOption('A5');
  await personal.getByLabel('Orientação', { exact: true }).selectOption('landscape');
  await personal.getByLabel('Margens (mm)', { exact: true }).fill('10');
  await personal.getByLabel('Linhas por página', { exact: true }).fill('3');
  await personal.getByLabel('Letra (pt)', { exact: true }).fill('20');
  const sample = 'E6++ nt\nD6 > E3 60 ATT E1 NC\nG3';
  await personal.getByLabel('Texto para pré-visualização', { exact: true }).fill(sample);
  await page.evaluate(() => {
    const append = document.body.appendChild;
    document.body.appendChild = function<T extends Node>(node: T): T {
      const result = append.call(this, node) as T;
      if (node instanceof HTMLIFrameElement && node.title === 'Caderno para impressão') node.contentWindow!.print = () => {};
      return result;
    };
  });
  const notebook = personal.locator('app-notebook');
  for (const value of ['center', 'left', 'right']) {
    await alignment.selectOption(value);
    await expect(notebook.getByRole('button', { name: 'Imprimir / Guardar PDF', exact: true })).toBeEnabled();
    await expect(notebook.locator('.notebook-pages .notebook-row').first()).toHaveCSS('justify-content', value === 'left' ? 'flex-start' : value === 'right' ? 'flex-end' : 'center');
    const deviations = await notebook.locator('.notebook-pages .notebook-row').evaluateAll((rows, mode) => rows.filter(row => row.querySelector('.note-block')).map(row => {
      const blocks = Array.from(row.querySelectorAll('.note-block'));
      const bounds = row.getBoundingClientRect(), first = blocks[0].getBoundingClientRect(), last = blocks[blocks.length - 1].getBoundingClientRect();
      return Math.abs(mode === 'left' ? first.left - bounds.left : mode === 'right' ? last.right - bounds.right : (first.left + last.right - bounds.left - bounds.right) / 2);
    }), value);
    expect(deviations.length).toBe(3); expect(Math.max(...deviations)).toBeLessThan(1);
    if (value === 'center') await notebook.locator('.notebook-page').first().screenshot({ path: '../.factory-results/FEAT-009-centered.png' });
    await notebook.getByRole('button', { name: 'Imprimir / Guardar PDF', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Caderno para impressão"]');
    await expect(frame.locator('.notebook-row').first()).toHaveCSS('justify-content', value === 'left' ? 'flex-start' : value === 'right' ? 'flex-end' : 'center');
    const html = await frame.locator('html').evaluate(node => node.outerHTML);
    const context = await browser.newContext(); const pdfPage = await context.newPage();
    await pdfPage.setContent(html);
    const pdf = await pdfPage.pdf({ preferCSSPageSize: true, printBackground: true, path: `../.factory-results/FEAT-009-${value}.pdf` });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(1);
    await context.close();
  }
  await expect(personal.getByLabel('Texto para pré-visualização', { exact: true })).toHaveValue(sample);
  const save = page.waitForResponse(response => response.url() === api && response.request().method() === 'PUT');
  await personal.getByRole('button', { name: 'Guardar modelo pessoal', exact: true }).click();
  const saved = await save; expect(saved.ok()).toBeTruthy(); expect(saved.request().postDataJSON().page.alignment).toBe('right');
  await page.reload();
  await page.getByRole('button', { name: 'Caderno e exportação', exact: true }).click();
  await expect(alignment).toHaveValue('right');
  expect((await (await request.get(api, { headers })).json()).page.alignment).toBe('right');
});
