import { expect, Page, test } from '@playwright/test';
import { defaultBookCover } from '../src/app/modules/core/notebook/book-cover.model';
import { defaultNotebook } from '../src/app/modules/core/notebook/notebook.model';

async function login(page: Page, email: string, destination: 'pecs' | 'account') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/' + destination + '$'));
  return { Authorization: 'Bearer ' + await page.evaluate(() => localStorage.getItem('recce_auth_token')) };
}

test('FEAT-023 revokes a grant while the reader has the published notebook open', async ({ page, browser, request }) => {
  const api = 'http://127.0.0.1:18765/api';
  const email = 'reader@e2e.invalid';
  const owner = await login(page, 'migrated@e2e.invalid', 'pecs');
  const rallyResponse = await request.post(api + '/rallies', {
    headers: owner, data: { name: 'Rali a revogar FEAT023', surface: 'TERRA', year: 2026, location: 'Fixture' },
  });
  expect(rallyResponse.ok()).toBeTruthy();
  const rally = await rallyResponse.json() as { id: string };
  const pecResponse = await request.post(api + '/rallies/' + rally.id + '/pecs', {
    headers: owner, data: { name: 'PEC revogável', number: 1, distanceKm: 2 },
  });
  expect(pecResponse.status()).toBe(201);
  const pec = await pecResponse.json() as { id: string };
  expect((await request.put(api + '/pecs/' + pec.id + '/book-publication', {
    headers: owner, data: { page: defaultNotebook().page, cover: defaultBookCover(), notes: [] },
  })).ok()).toBeTruthy();
  expect((await request.post(api + '/rallies/' + rally.id + '/invitations', { headers: owner, data: { email } })).status()).toBe(202);

  const readerPage = await browser.newPage({ viewport: { width: 390, height: 850 } });
  try {
    const reader = await login(readerPage, email, 'account');
    const inbox = await (await request.get(api + '/notifications', { headers: reader })).json() as { items: { id: string; rallyId: string }[] };
    const invite = inbox.items.find(item => item.rallyId === rally.id)!;
    await readerPage.goto('/notifications/' + invite.id);
    await readerPage.getByRole('button', { name: 'Aceitar convite' }).click();
    await readerPage.getByRole('link', { name: 'Consultar rali' }).click();
    await readerPage.getByRole('link', { name: 'PEC 1 · PEC revogável' }).click();
    await readerPage.getByRole('button', { name: 'Abrir caderno publicado' }).click();
    const print = readerPage.getByRole('button', { name: 'Imprimir / Guardar PDF' });
    await expect(print).toBeEnabled();

    await page.goto('/rally/' + rally.id);
    await page.getByText('Acessos ao rali', { exact: true }).click();
    await page.getByLabel('Motivo da revogação').selectOption({ label: 'Fim da colaboração' });
    await page.getByRole('button', { name: 'Revogar acesso de ' + email }).click();
    const dialog = page.getByRole('dialog', { name: 'Revogar acesso de leitura?' });
    await expect(dialog).toContainText('ficheiros já descarregados');
    await dialog.getByRole('button', { name: 'Revogar acesso', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Acesso revogado.' })).toBeVisible();
    await page.getByText('Histórico de acessos', { exact: true }).click();
    await expect(page.getByText('Concessão revogada', { exact: false })).toBeVisible();

    const denied = readerPage.waitForResponse(response => response.request().method() === 'HEAD'
      && response.url().endsWith('/book-publication'));
    await print.evaluate(button => button.scrollIntoView({ block: 'center' }));
    await print.click();
    expect((await denied).status()).toBe(404);
    await expect(readerPage.getByRole('alert')).toContainText('não está disponível para a tua conta');
    await expect(readerPage.locator('iframe[title="Caderno para impressão"]')).toHaveCount(0);
    await expect(readerPage.getByText('Versão publicada 1')).toHaveCount(0);

    await readerPage.goto('/notifications/' + invite.id);
    await expect(readerPage.getByRole('status').filter({ hasText: 'Aceite' })).toBeVisible();
    await expect(readerPage.getByText('Acesso revogado.')).toBeVisible();
    await expect(readerPage.getByRole('link', { name: 'Consultar rali' })).toHaveCount(0);
    const shared = await (await request.get(api + '/shared-rallies', { headers: reader })).json() as { id: string }[];
    expect(shared.some(item => item.id === rally.id)).toBe(false);
    expect(shared.length).toBeGreaterThan(0);
  } finally {
    await readerPage.close();
  }
});
