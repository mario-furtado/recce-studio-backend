import { expect, Page, test } from '@playwright/test';
import { defaultBookCover } from '../src/app/modules/core/notebook/book-cover.model';
import { defaultNotebook } from '../src/app/modules/core/notebook/notebook.model';

const api = 'http://127.0.0.1:18765/api';

async function login(page: Page, email: string, destination: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(destination + '$'));
  return { Authorization: 'Bearer ' + await page.evaluate(() => localStorage.getItem('recce_auth_token')) };
}

test('FEAT-025 archive and history preserve the published PDF until explicit revocation', async ({ page, browser, request }) => {
  const owner = await login(page, 'migrated@e2e.invalid', '/pecs');
  const readerEmail = 'reader@e2e.invalid';
  const rallyResponse = await request.post(api + '/rallies', {
    headers: owner, data: { name: 'Rali Histórico P08', year: 2026, surface: 'TERRA', location: 'Serra' },
  });
  expect(rallyResponse.ok()).toBeTruthy();
  const { id } = await rallyResponse.json() as { id: string };
  const stage = await request.post(api + '/rallies/' + id + '/pecs', {
    headers: owner, data: { name: 'PEC de arquivo', number: 1, distanceKm: 2 },
  });
  expect(stage.status()).toBe(201);
  const { id: pec } = await stage.json() as { id: string };
  const rallyPath = '/rally/' + id;
  const stagePath = '/shared-rallies/' + id + '/pecs/' + pec;
  const publication = api + '/pecs/' + pec + '/book-publication';
  expect((await request.put(publication, {
    headers: owner, data: {
      page: defaultNotebook().page, cover: defaultBookCover(),
      notes: [[{ breakBefore: false, elements: [{ display: 'D6 P08', position: 'center', size: 100, bold: true, underline: false, highlight: false }] }]],
    },
  })).ok()).toBeTruthy();
  expect((await request.post(api + '/rallies/' + id + '/invitations', { headers: owner, data: { email: readerEmail } })).status()).toBe(202);

  const readerPage = await browser.newPage({ viewport: { width: 360, height: 850 } });
  try {
    const reader = await login(readerPage, readerEmail, '/account');
    const inbox = await (await request.get(api + '/notifications', { headers: reader })).json() as { items: { id: string; rallyId: string }[] };
    await readerPage.goto('/notifications/' + inbox.items.find(item => item.rallyId === id)!.id);
    await readerPage.getByRole('button', { name: 'Aceitar convite' }).click();
    await expect(readerPage.getByRole('link', { name: 'Consultar rali' })).toBeVisible();
    await readerPage.goto('/rally-history');
    await expect(readerPage.getByRole('region', { name: 'Partilhados comigo · Só leitura' }).getByText('A carregar…')).toBeHidden();
    await expect(readerPage.getByRole('link', { name: 'Rali Histórico P08' })).toHaveCount(0);
    await expect(readerPage.getByRole('option', { name: 'Área de trabalho' })).toHaveCount(0);

    await page.goto(rallyPath);
    await page.getByRole('button', { name: 'Terminar Rali' }).click();
    await page.getByRole('dialog', { name: 'Terminar Rali' }).getByRole('button', { name: 'Terminar Rali' }).click();
    await expect(page.getByText('Concluído', { exact: true })).toBeVisible();
    await readerPage.reload();
    await expect(readerPage.getByRole('link', { name: 'Rali Histórico P08' })).toBeVisible();

    await page.getByRole('button', { name: 'Arquivar rali' }).click();
    await page.getByRole('dialog', { name: 'Arquivar rali' }).getByRole('button', { name: 'Arquivar rali' }).click();
    await expect(page.getByRole('button', { name: 'Restaurar rali' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar Nova PEC' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Voltar a Rascunho' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Consultar PEC' }).click();
    await expect(page.getByText('Rali arquivado · Consulta')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reconhecimento', exact: true })).toBeDisabled();

    await page.route('**/api/shared-rallies', route => route.fulfill({ status: 503, json: {} }));
    await page.goto('/rally-history');
    const ownHistory = page.getByRole('region', { name: 'Área de trabalho' });
    const sharedHistory = page.getByRole('region', { name: 'Partilhados comigo · Só leitura' });
    await expect(ownHistory.getByRole('link', { name: 'Rali Histórico P08' })).toHaveAttribute('href', rallyPath);
    await expect(sharedHistory.getByRole('alert')).toBeVisible();
    await page.unroute('**/api/shared-rallies');
    await sharedHistory.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(sharedHistory.getByRole('alert')).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Origem', exact: true }).selectOption('own');
    await expect(sharedHistory).toHaveCount(0);

    await readerPage.reload();
    const stateFilter = readerPage.getByRole('combobox', { name: 'Estado', exact: true });
    await stateFilter.selectOption('completed');
    await expect(readerPage.getByRole('link', { name: 'Rali Histórico P08' })).toHaveCount(0);
    await stateFilter.selectOption('archived');
    const link = readerPage.getByRole('link', { name: 'Rali Histórico P08' });
    await expect(link).toHaveAttribute('href', '/shared-rallies/' + id);
    expect(await readerPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await readerPage.screenshot({ path: '../.factory-results/FEAT-025-history-mobile.png', fullPage: true });
    await link.focus();
    await readerPage.keyboard.press('Enter');
    await expect(readerPage.getByText('TERRA · Arquivado')).toBeVisible();
    await expect(readerPage.getByRole('button', { name: /Arquivar|Restaurar/ })).toHaveCount(0);
    await readerPage.getByRole('link', { name: 'PEC 1 · PEC de arquivo' }).click();
    await readerPage.getByRole('button', { name: 'Abrir caderno publicado' }).click();
    await readerPage.evaluate(() => {
      const append = document.body.appendChild;
      document.body.appendChild = function<T extends Node>(node: T): T {
        const result = append.call(this, node) as T;
        if (node instanceof HTMLIFrameElement && node.title === 'Caderno para impressão') node.contentWindow!.print = () => {};
        return result;
      };
    });
    await readerPage.getByRole('button', { name: 'Imprimir / Guardar PDF' }).click();
    const printed = readerPage.frameLocator('iframe[title="Caderno para impressão"]').locator('.book-sheet');
    await expect(printed).toHaveCount(3);
    await expect(printed.nth(1)).toContainText('D6 P08');

    await page.goto(rallyPath);
    await page.getByRole('button', { name: 'Restaurar rali' }).click();
    await page.getByRole('dialog', { name: 'Restaurar rali' }).getByRole('button', { name: 'Restaurar rali' }).click();
    await expect(page.getByRole('button', { name: 'Voltar a Rascunho' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar a Rascunho' }).click();
    await expect(page.getByRole('button', { name: 'Adicionar Nova PEC' })).toBeEnabled();
    expect((await request.head(api + stagePath + '/book-publication', { headers: reader })).status()).toBe(200);
    const access = await (await request.get(api + '/rallies/' + id + '/access', { headers: owner })).json();
    expect((await request.post(api + '/rallies/' + id + '/access/' + access.items[0].id + '/revoke', {
      headers: owner, data: { reason: 'OTHER' },
    })).status()).toBe(204);
    await readerPage.goto(stagePath);
    await expect(readerPage.getByRole('alert')).toContainText('não está disponível para a tua conta');
    expect((await request.head(api + stagePath + '/book-publication', { headers: reader })).status()).toBe(404);
  } finally {
    await readerPage.close();
  }
});
