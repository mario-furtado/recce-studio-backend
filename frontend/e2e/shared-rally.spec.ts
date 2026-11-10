import { expect, Page, test } from '@playwright/test';
import { defaultNotebook } from '../src/app/modules/core/notebook/notebook.model';

async function login(page: Page, account: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(account + '@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test('FEAT-021 reader opens only the granted rally and exports the owner publication', async ({ page, browser, request }) => {
  const api = 'http://127.0.0.1:18765/api';
  await login(page, 'reader');
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('link', { name: 'Ralis partilhados comigo' }).click();
  await expect(page.getByRole('link', { name: 'Rali legado FEAT020' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Rali partilhado FEAT021' }).click();
  await expect(page.getByText('TERRA · Concluído')).toBeVisible();
  await page.getByRole('link', { name: 'PEC 1 · PEC partilhada' }).click();
  await expect(page.getByRole('heading', { name: 'PEC partilhada' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Notas da PEC' })).toContainText('D6 publicado');
  await expect(page.getByRole('region', { name: 'Mapa do reconhecimento' })).toBeVisible();
  await expect(page.locator('audio')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('button', { name: 'Editar PEC' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir caderno publicado' }).click();
  await expect(page.getByText('O proprietário ainda não publicou o caderno desta PEC.')).toBeVisible();

  const owner = await browser.newPage();
  try {
    await login(owner, 'migrated');
    await expect(owner).toHaveURL(/\/pecs$/);
    const headers = { Authorization: 'Bearer ' + await owner.evaluate(() => localStorage.getItem('recce_auth_token')) };
    const settings = defaultNotebook();
    const turn = settings.rules.find(rule => rule.match === 'D6')!;
    turn.display = 'D6+';
    turn.meaning = 'definição privada';
    expect((await request.put(api + '/notebook-preferences', { headers, data: settings })).ok()).toBeTruthy();
    await owner.goto('/recce/shared-e2e-pec');
    await owner.getByRole('button', { name: 'Studio', exact: true }).click();
    await owner.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
    await owner.getByRole('button', { name: 'Publicar caderno', exact: true }).click();
    await expect(owner.getByText('Versão 1 publicada.', { exact: true })).toBeVisible();
    turn.display = 'D6 alterado depois';
    expect((await request.put(api + '/notebook-preferences', { headers, data: settings })).ok()).toBeTruthy();
  } finally {
    await owner.close();
  }

  await page.getByRole('button', { name: 'Verificar publicação' }).click();
  await expect(page.getByText('Versão publicada 1', { exact: true })).toBeVisible();
  const notebook = page.locator('app-notebook');
  const pages = notebook.locator('.notebook-pages');
  await expect(pages).toContainText('D6+');
  await expect(pages).not.toContainText('D6 alterado depois');
  await expect(pages.locator('[title="definição privada"]')).toHaveCount(0);
  await expect(pages.locator('.notebook-row').first()).toHaveCSS('font-size', '32px');
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const panel of [page.locator('audio'), page.getByRole('region', { name: 'Mapa do reconhecimento' }), notebook.locator('.notebook-scroll')]) {
    const bounds = await panel.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: '../.factory-results/FEAT-021-reader.png', fullPage: true });

  await page.evaluate(() => {
    const append = document.body.appendChild;
    document.body.appendChild = function<T extends Node>(node: T): T {
      const result = append.call(this, node) as T;
      if (node instanceof HTMLIFrameElement && node.title === 'Caderno para impressão') node.contentWindow!.print = () => {};
      return result;
    };
  });
  await notebook.getByRole('button', { name: 'Imprimir / Guardar PDF' }).click();
  const frame = page.frameLocator('iframe[title="Caderno para impressão"]');
  await expect(frame.locator('.book-sheet')).toHaveCount(3);
  await expect(frame.locator('.book-sheet').nth(1)).toContainText('D6+');
  const pdfPage = await browser.newPage();
  try {
    await pdfPage.setContent(await frame.locator('html').evaluate(node => node.outerHTML));
    const pdf = await pdfPage.pdf({ preferCSSPageSize: true, printBackground: true, path: '../.factory-results/FEAT-021-publication.pdf' });
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(3);
  } finally {
    await pdfPage.close();
  }
});
