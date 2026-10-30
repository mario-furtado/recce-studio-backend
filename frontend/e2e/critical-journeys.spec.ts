import { test, expect, Page, APIRequestContext } from '@playwright/test';

const api = 'http://127.0.0.1:18765/api';
const password = () => {
  const value = process.env['RECCE_E2E_PASSWORD'];
  if (!value) throw new Error('Missing ephemeral fixture password');
  return value;
};

async function login(page: Page, account = 'owner') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${account}@e2e.invalid`);
  await page.getByLabel('Password', { exact: true }).fill(password());
  const loaded = page.waitForResponse(r => r.url() === `${api}/rallies` && r.request().method() === 'GET');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const response = await loaded;
  expect(response.status()).toBe(200);
  const rallies = await response.json() as { id: string }[];
  await expect(page).toHaveURL(/\/pecs$/);
  await expect(page.getByRole('heading', { name: 'Ralis & PECs' })).toBeVisible();
  return rallies;
}

async function apiToken(request: APIRequestContext, account = 'owner') {
  const response = await request.post(`${api}/auth/login`, {
    data: { email: `${account}@e2e.invalid`, password: password() },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).token as string;
}

test('real login, rally/PEC/note creation, reload persistence and logout revocation', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill('deliberately-wrong');
  const denied = page.waitForResponse(r => r.url() === `${api}/auth/login`);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  expect((await denied).status()).toBe(400);
  await expect(page.getByText('Credenciais invalidas.', { exact: true })).toBeVisible();
  await login(page);

  await page.goto('/new-recce');
  await page.getByRole('link', { name: 'Escolher ou criar uma PEC' }).click();
  await page.getByRole('button', { name: 'Criar novo rali', exact: true }).click();
  await page.getByLabel('NOME DO RALI *', { exact: true }).fill('QA browser rally');
  await page.getByLabel('ANO', { exact: true }).fill('2026');
  await page.getByLabel('LOCALIZAÇÃO *', { exact: true }).fill('Fixture location');
  const rallyCreated = page.waitForResponse(r => r.url() === `${api}/rallies` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Criar Rali', exact: true }).click();
  expect((await rallyCreated).status()).toBe(200);
  const card = page.locator('.interactive-card').filter({ hasText: 'QA browser rally' });
  await card.getByRole('button', { name: 'Ver Rali e PECs' }).click();
  await expect(page).toHaveURL(/\/rally\/[^/]+$/);
  await page.getByRole('button', { name: 'Adicionar Nova PEC', exact: true }).click();
  await page.getByLabel('Nome da PEC', { exact: true }).fill('QA browser PEC');
  await page.getByLabel('Distancia (Km)', { exact: true }).fill('2.5');
  const pecCreated = page.waitForResponse(r => /\/rallies\/[^/]+\/pecs$/.test(r.url()) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Criar PEC', exact: true }).click();
  const pecResponse = await pecCreated;
  expect(pecResponse.status()).toBe(201);
  const pec = await pecResponse.json();
  await page.getByRole('link', { name: 'Continuar reconhecimento', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/recce/${pec.id}$`));
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await page.getByRole('button', { name: /Inserir Nota/ }).click();
  await page.getByLabel('Texto da nova nota', { exact: true }).fill('D3 browser persisted');
  await page.getByLabel('Observações da nova nota', { exact: true }).fill('gravilha');
  const noteSaved = page.waitForResponse(r => r.url() === `${api}/pecs/${pec.id}/notes` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  expect((await noteSaved).status()).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await expect(page.getByText('D3 browser persisted', { exact: true })).toBeVisible();
  await expect(page.locator('.notes-list').getByText('gravilha', { exact: true })).toBeVisible();

  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  expect(token).toBeTruthy();
  // The sidebar has a second quick-panel logout button; scope to its visible aside.
  await page.locator('aside').getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get(`${api}/auth/validate`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
});

test('a second real account cannot list, open or modify another team PEC', async ({ page, request }) => {
  const ownerToken = await apiToken(request);
  const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
  const rallyResponse = await request.post(`${api}/rallies`, { headers: ownerHeaders,
    data: { name: 'Owner private rally', year: 2026, surface: 'TERRA', location: 'Fixture', status: 'DRAFT' } });
  expect(rallyResponse.status()).toBe(200);
  const rally = await rallyResponse.json();
  const pecResponse = await request.post(`${api}/rallies/${rally.id}/pecs`, { headers: ownerHeaders,
    data: { number: 1, name: 'Owner private PEC', distanceKm: 1, status: 'DRAFT' } });
  expect(pecResponse.status()).toBe(201);
  const pec = await pecResponse.json();
  const visibleRallies = await login(page, 'other');
  expect(visibleRallies.map(item => item.id)).not.toContain(rally.id);
  await expect(page.getByRole('heading', { name: 'Owner private rally 2026', exact: true })).toHaveCount(0);
  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  const headers = { Authorization: `Bearer ${token}` };
  await page.goto(`/recce/${pec.id}`);
  await expect(page.getByRole('heading', { name: 'PEC indisponível' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Studio', exact: true })).toHaveCount(0);
  expect((await request.patch(`${api}/pecs/${pec.id}`, { headers, data: { name: 'Spoofed' } })).status()).toBe(404);
  const unchanged = await request.get(`${api}/pecs/${pec.id}`, { headers: ownerHeaders });
  expect(unchanged.status()).toBe(200);
  expect((await unchanged.json()).name).toBe('Owner private PEC');
  await page.getByRole('link', { name: 'Escolher destino' }).click();
  await expect(page.getByRole('heading', { name: 'Novo reconhecimento' })).toBeVisible();
});

test('server-revoked sessions recover to login instead of showing protected data', async ({ page, request }) => {
  await login(page);
  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  expect((await request.post(`${api}/auth/logout`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(204);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Ralis & PECs' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('recce_auth_token'))).toBeNull();
});
