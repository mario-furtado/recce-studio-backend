import { test, expect } from '@playwright/test';

test.use({ launchOptions: {
  executablePath: process.env['CHROME_BIN'] || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
} });

test('FEAT-019 / FEAT-026 isolates two crews and resumes offline audio in the original crew', async ({ page, request }) => {
  const api = 'http://127.0.0.1:18765';
  const email = `crew-${Date.now()}@example.invalid`, password = 'Crew-password-2026';
  expect((await request.post(`${api}/api/auth/register`, { data: { email } })).status()).toBe(202);
  const mailbox = await (await request.get(`${api}/e2e/mailbox?email=${encodeURIComponent(email)}`, { headers: { 'X-E2E-Key': process.env['RECCE_E2E_PASSWORD']! } })).json() as { token: string }[];
  expect((await request.post(`${api}/api/auth/verify-email`, { data: { token: mailbox[0].token, password } })).status()).toBe(204);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 38.7, longitude: -9.1 });
  await page.addInitScript(() => {
    const start = MediaRecorder.prototype.start;
    MediaRecorder.prototype.start = function(timeslice?: number) {
      this.addEventListener('dataavailable', event => {
        if (event.data.size) document.documentElement.dataset['recordedAudio'] = 'ready';
      });
      start.call(this, timeslice);
    };
  });
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
  const manager = page.locator('app-crew-manager'); await expect(manager).toContainText('primeira tripulação');
  const ids: string[] = [];
  for (const name of ['Tripulação A', 'Tripulação B']) {
    await manager.getByLabel('Nome da nova tripulação').fill(name);
    const created = page.waitForResponse(r => r.url().endsWith('/api/crews') && r.request().method() === 'POST');
    await manager.getByRole('button', { name: 'Criar tripulação', exact: true }).click(); const response = await created; expect(response.status()).toBe(200); ids.push((await response.json()).id);
    await expect(manager.getByRole('button', { name: `Abrir tripulação ${name}`, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: '../.factory-results/FEAT-019-crews-desktop.png', fullPage: true });
  async function openCrew(name: string) { await page.getByRole('link', { name: 'A minha conta', exact: true }).click(); await page.getByRole('button', { name: `Abrir tripulação ${name}`, exact: true }).click(); await expect(page).toHaveURL(/\/pecs$/); }
  async function createRally(name: string) {
    await page.getByRole('button', { name: 'Criar novo rali', exact: true }).click();
    await page.getByLabel('NOME DO RALI *', { exact: true }).fill(name); await page.getByLabel('LOCALIZAÇÃO *', { exact: true }).fill('Serra');
    const created = page.waitForResponse(r => r.url().endsWith('/api/rallies') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Criar Rali', exact: true }).click(); const result = await created; expect(result.status()).toBe(200); return (await result.json()).id as string;
  }
  await manager.getByRole('button', { name: 'Abrir tripulação Tripulação A', exact: true }).click(); await expect(page).toHaveURL(/\/pecs$/);
  await expect(page.getByText('Tripulação: Tripulação A', { exact: true })).toBeVisible();
  const rallyA = await createRally('Rali só de A');
  await page.goto('/recce-mode');
  await page.getByRole('button', { name: 'INICIAR RECONHECIMENTO', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-recorded-audio', 'ready');
  await page.getByRole('button', { name: 'FINALIZAR E GUARDAR', exact: true }).click();
  await expect(page).toHaveURL(/\/offline-recces$/);
  await page.getByRole('button', { name: 'Criar PEC', exact: true }).click();
  await page.getByRole('combobox', { name: 'Rali', exact: true }).selectOption(rallyA);
  await page.getByRole('textbox', { name: 'Nome da PEC', exact: true }).fill('PEC offline da tripulação A');
  const audioPath = '**/api/offline-recces/sync/*/audio';
  await page.route(audioPath, route => route.abort());
  const audioAttempt = page.waitForRequest(outgoing => outgoing.url().endsWith('/audio') && outgoing.url().includes('/offline-recces/sync/'));
  const receiptResponse = page.waitForResponse(response => response.url().endsWith('/api/offline-recces/sync'));
  await page.getByRole('button', { name: 'Criar e sincronizar' }).click();
  const notesResponse = await receiptResponse;
  expect(notesResponse.status()).toBe(200);
  const receipt = await notesResponse.json() as { syncId: string; pecId: string };
  expect((await audioAttempt).url()).toContain('/sync/' + receipt.syncId + '/audio');
  await expect(page.getByRole('button', { name: 'Repetir sincronização' })).toBeEnabled();
  await openCrew('Tripulação B'); await expect(page.getByRole('article', { name: 'Rali só de A', exact: true })).toHaveCount(0);
  await page.goto('/offline-recces');
  await expect(page.getByText('Sem reconhecimentos offline pendentes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Repetir sincronização' })).toHaveCount(0);
  await page.goto('/pecs');
  await createRally('Rali só de B'); await openCrew('Tripulação A');
  await expect(page.getByRole('article', { name: 'Rali só de A', exact: true })).toBeVisible(); await expect(page.getByRole('article', { name: 'Rali só de B', exact: true })).toHaveCount(0);
  await page.goto('/offline-recces');
  await page.unroute(audioPath);
  await expect(page.getByText('Destino guardado · PEC offline da tripulação A')).toBeVisible();
  const uploaded = page.waitForResponse(response => response.url().endsWith('/sync/' + receipt.syncId + '/audio'));
  await page.getByRole('button', { name: 'Repetir sincronização' }).click();
  expect((await uploaded).status()).toBe(204);
  await expect(page.getByText('Sem reconhecimentos offline pendentes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Repetir sincronização' })).toHaveCount(0);
  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  const ownerA = { Authorization: `Bearer ${token}`, 'X-Crew-Id': ids[0] };
  const stages = await (await request.get(`${api}/api/rallies/${rallyA}/pecs`, { headers: ownerA })).json();
  expect(stages.map((stage: { id: string }) => stage.id)).toEqual([receipt.pecId]);
  const audio = await request.get(`${api}/api/pecs/${receipt.pecId}/audio`, { headers: ownerA });
  expect(audio.ok()).toBeTruthy();
  expect((await audio.body()).length).toBeGreaterThan(0);
  expect((await request.get(`${api}/api/rallies/${rallyA}`, { headers: { Authorization: `Bearer ${token}`, 'X-Crew-Id': ids[1] } })).status()).toBe(404);
  expect((await request.post(`${api}/api/offline-recces/sync`, { headers: { Authorization: `Bearer ${token}`, 'X-Crew-Id': ids[0] }, data: {} })).status()).toBe(403);
  expect((await request.post(`${api}/api/offline-recces;v=1/sync`, { headers: { Authorization: `Bearer ${token}`, 'X-Crew-Id': ids[0] }, data: {} })).status()).toBe(403);
  await page.goto('/offline-recces'); await expect(page).toHaveURL(/\/offline-recces$/);
  // Another tab signs in: an old crew selection must not silently fall back to a legacy team.
  const renewed = await (await request.post(`${api}/api/auth/login`, { data: { email, password } })).json();
  await page.evaluate(value => localStorage.setItem('recce_auth_token', value), renewed.token);
  await page.goto('/pecs'); await expect(page).toHaveURL(/\/account$/); await expect(page.getByRole('alert')).toContainText('A sessão mudou');
  await page.getByRole('button', { name: 'Abrir tripulação Tripulação A', exact: true }).click(); await expect(page).toHaveURL(/\/pecs$/);
  await page.getByRole('link', { name: 'A minha conta', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 }); await expect(manager.getByRole('button', { name: 'Sair da tripulação', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: '../.factory-results/FEAT-019-crews-mobile.png', fullPage: true });
  await manager.getByRole('button', { name: 'Sair da tripulação', exact: true }).click(); await expect(manager.getByRole('button', { name: 'Sair da tripulação', exact: true })).toHaveCount(0);
  await page.goto('/pecs'); await expect(page).toHaveURL(/\/account$/);
  expect(await page.evaluate(() => sessionStorage.getItem('recce_crew_context'))).toBeNull();
});
