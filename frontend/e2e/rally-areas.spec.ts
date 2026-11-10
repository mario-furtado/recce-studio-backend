import { expect, test } from '@playwright/test';
import { defaultNotebook } from '../src/app/modules/core/notebook/notebook.model';

test('FEAT-024 alternates owned and READ rallies without changing the active crew or losing a draft', async ({ page, request }) => {
  const api = 'http://127.0.0.1:18765/api';
  const password = 'Rally-areas-password-2026';
  const email = `rally-areas-${Date.now()}@example.invalid`;
  const e2ePassword = process.env['RECCE_E2E_PASSWORD']!;
  expect((await request.post(api + '/auth/register', { data: { email } })).status()).toBe(202);
  const mailbox = await request.get('http://127.0.0.1:18765/e2e/mailbox?email=' + encodeURIComponent(email), {
    headers: { 'X-E2E-Key': e2ePassword },
  });
  const [{ token }] = await mailbox.json();
  expect((await request.post(api + '/auth/verify-email', { data: { token, password } })).status()).toBe(204);
  const ownerLogin = await request.post(api + '/auth/login', { data: { email: 'migrated@e2e.invalid', password: e2ePassword } });
  const owner = { Authorization: 'Bearer ' + (await ownerLogin.json()).token };
  const rallyData = { surface: 'TERRA', year: 2026, location: 'Serra' };
  async function createRally(name: string, headers: Record<string, string>) {
    const response = await request.post(api + '/rallies', { headers, data: { ...rallyData, name } });
    expect(response.status()).toBe(200);
    return (await response.json()).id as string;
  }
  const sharedId = await createRally('Rali concedido P07', owner);
  await createRally('Rali privado P07', owner);
  const stage = await request.post(api + '/rallies/' + sharedId + '/pecs', {
    headers: owner, data: { name: 'PEC concedida P07', number: 1, distanceKm: 2 },
  });
  expect(stage.status()).toBe(201);
  const sharedStage = (await stage.json()).id as string;

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Para criares o teu primeiro rali', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Ralis partilhados comigo' }).click();
  await expect(page.getByText('Ainda não tens ralis partilhados.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar novo rali' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Escolher tripulação' }).click();

  async function prepareCrew(name: string) {
    await page.getByLabel('Nome da nova tripulação').fill(name);
    await page.getByRole('button', { name: 'Criar tripulação', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir tripulação ' + name, exact: true }).click();
    await expect(page.getByText('Tripulação: ' + name, { exact: true })).toBeVisible();
  }
  await prepareCrew('A P07');
  await expect(page.getByRole('heading', { name: 'Ainda não tens ralis' })).toBeVisible();
  await page.getByRole('button', { name: 'Criar novo rali' }).click();
  await page.getByLabel('NOME DO RALI *', { exact: true }).fill('Rali próprio A P07');
  await page.getByLabel('LOCALIZAÇÃO *', { exact: true }).fill('Serra');
  await page.getByRole('button', { name: 'Criar Rali', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Rali próprio A P07' })).toBeVisible();
  const reader = { Authorization: 'Bearer ' + await page.evaluate(() => localStorage.getItem('recce_auth_token')) };
  const context = () => page.evaluate(() => sessionStorage.getItem('recce_crew_context'));
  const crewA = (await context())!;
  const crewId = (JSON.parse(crewA) as { id: string }).id;
  const workspace = { ...reader, 'X-Crew-Id': crewId };
  const personalBefore = defaultNotebook();
  personalBefore.page.fontPt = 28;
  expect((await request.put(api + '/notebook-preferences', { headers: workspace, data: personalBefore })).ok()).toBeTruthy();
  const beforeInviting = await (await request.get(api + '/notifications', { headers: reader })).json();
  expect(beforeInviting.items).toEqual([]);

  expect((await request.post(api + '/rallies/' + sharedId + '/invitations', { headers: owner, data: { email } })).status()).toBe(202);
  const inbox = await (await request.get(api + '/notifications', { headers: reader })).json() as { items: { id: string; rallyId: string }[] };
  expect(inbox.items.map(item => item.rallyId)).toEqual([sharedId]);
  await page.goto('/notifications/' + inbox.items[0].id);
  await page.getByRole('button', { name: 'Aceitar convite' }).click();
  await expect(page.getByRole('link', { name: 'Consultar rali' })).toBeVisible();
  await page.goto('/pecs');
  const areas = page.getByRole('navigation', { name: 'Áreas de ralis' });
  await expect(areas.getByRole('link', { name: 'Os meus ralis' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('searchbox', { name: 'Pesquisar ralis' }).fill('P07');
  await expect(page.getByText('1 de 1 ralis', { exact: false })).toBeVisible();
  await expect(page.getByText('Rali concedido P07')).toHaveCount(0);

  await page.getByRole('button', { name: 'Criar novo rali' }).click();
  await page.getByLabel('NOME DO RALI *', { exact: true }).fill('Rascunho P07');
  await areas.getByRole('link', { name: 'Escolher tripulação' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sair do formulário do rali?' });
  await dialog.getByRole('button', { name: 'Continuar a editar' }).click();
  await expect(page.getByLabel('NOME DO RALI *', { exact: true })).toHaveValue('Rascunho P07');
  expect(await context()).toBe(crewA);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.route('**/api/shared-rallies', route => route.fulfill({ status: 503, json: {} }));
  const sharedLink = areas.getByRole('link', { name: 'Ralis partilhados' });
  await sharedLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await areas.getByRole('link', { name: 'Os meus ralis' }).click();
  await expect(page.getByRole('article', { name: 'Rali próprio A P07' })).toBeVisible();
  await areas.getByRole('link', { name: 'Ralis partilhados' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await page.unroute('**/api/shared-rallies');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('link', { name: 'Rali concedido P07' })).toBeVisible();
  await expect(page.getByText('Rali privado P07')).toHaveCount(0);
  await expect(page.getByText('Rali próprio A P07')).toHaveCount(0);
  expect((await request.put(api + '/rallies/' + sharedId, {
    headers: workspace, data: { name: 'escrita forçada' },
  })).status()).toBe(404);

  await page.goto('/shared-rallies/' + sharedId + '/pecs/' + sharedStage);
  await expect(page.getByRole('heading', { name: 'PEC concedida P07' })).toBeVisible();
  await expect(page.getByText('Partilhado comigo · Só leitura')).toBeVisible();
  await expect(page.getByText('Tripulação: A P07', { exact: true })).toHaveCount(0);
  expect(await context()).toBe(crewA);
  expect(await (await request.get(api + '/notebook-preferences', { headers: workspace })).json()).toEqual(personalBefore);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: '../.factory-results/FEAT-024-read-mobile.png', fullPage: true });

  const access = await (await request.get(api + '/rallies/' + sharedId + '/access', { headers: owner })).json();
  const grantId = access.items[0].id;
  expect((await request.post(api + '/rallies/' + sharedId + '/access/' + grantId + '/revoke', {
    headers: owner, data: { reason: 'OTHER' },
  })).status()).toBe(204);
  const denied = page.waitForResponse(response => response.request().method() === 'HEAD'
    && response.url().endsWith('/pecs/' + sharedStage));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect((await denied).status()).toBe(404);
  await expect(page.getByRole('alert')).toContainText('não está disponível para a tua conta');
  await expect(page.getByRole('heading', { name: 'PEC concedida P07' })).toHaveCount(0);
  expect(await context()).toBe(crewA);

  await areas.getByRole('link', { name: 'Escolher tripulação' }).click();
  await prepareCrew('B P07');
  await expect(page.getByRole('heading', { name: 'Ainda não tens ralis' })).toBeVisible();
  await expect(page.getByText('Rali próprio A P07')).toHaveCount(0);
  await areas.getByRole('link', { name: 'Escolher tripulação' }).click();
  await page.getByRole('button', { name: 'Abrir tripulação A P07', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Rali próprio A P07' })).toBeVisible();
});
