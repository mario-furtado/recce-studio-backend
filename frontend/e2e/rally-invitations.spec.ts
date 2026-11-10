import { expect, Page, test } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test('FEAT-022 owner invites an address before registration and the verified reader accepts only that rally', async ({ page, request, browser }) => {
  const base = 'http://127.0.0.1:18765';
  const email = `invited-${Date.now()}@e2e.invalid`;
  const password = 'Invitation-password-2026';
  const fixturePassword = process.env['RECCE_E2E_PASSWORD']!;
  const rallyName = 'Rali com convite FEAT022';
  await login(page, 'migrated@e2e.invalid', fixturePassword);
  await expect(page).toHaveURL(/\/pecs$/);
  const ownerToken = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  const created = await request.post(base + '/api/rallies', {
    headers: { Authorization: 'Bearer ' + ownerToken },
    data: { name: rallyName, surface: 'TERRA', year: 2026, location: 'Fixture' },
  });
  expect(created.ok()).toBeTruthy();
  const rally = await created.json() as { id: string };
  await page.goto('/rally/' + rally.id);
  await page.getByText('Convites de leitura', { exact: true }).click();
  await expect(page.getByText('Apenas este rali.', { exact: false })).toBeVisible();
  await page.getByLabel('Email do destinatário').fill(email);
  await page.getByRole('button', { name: 'Enviar convite', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Pedido recebido' })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  const mailbox = base + '/e2e/mailbox?email=' + encodeURIComponent(email);
  const headers = { 'X-E2E-Key': fixturePassword };
  expect(await (await request.get(mailbox, { headers })).json()).toEqual([]);
  expect((await request.post(base + '/api/auth/register', { data: { email } })).status()).toBe(202);
  const messages = await (await request.get(mailbox, { headers })).json() as { purpose: string; token: string }[];
  expect(messages.map(message => message.purpose)).toEqual(['VERIFY']);
  expect((await request.post(base + '/api/auth/verify-email', {
    data: { token: messages[0].token, password },
  })).status()).toBe(204);

  const reader = await browser.newPage({ viewport: { width: 390, height: 850 } });
  try {
    await login(reader, email, password);
    await expect(reader).toHaveURL(/\/account$/);
    const token = await reader.evaluate(() => localStorage.getItem('recce_auth_token'));
    const auth = { Authorization: 'Bearer ' + token };
    const shared = base + '/api/shared-rallies/' + rally.id;
    expect((await request.get(shared, { headers: auth })).status()).toBe(404);
    await reader.getByRole('link', { name: 'Notificações, 1 por ler' }).click();
    await reader.getByRole('link', { name: rallyName, exact: true }).click();
    await expect(reader.getByText('Apenas este rali · Só leitura')).toBeVisible();
    await reader.getByRole('button', { name: 'Marcar como lida' }).click();
    await expect(reader.getByRole('link', { name: 'Notificações', exact: true })).toBeVisible();
    expect((await request.get(shared, { headers: auth })).status()).toBe(404);
    await reader.getByRole('button', { name: 'Aceitar convite' }).click();
    await expect(reader.getByRole('status').filter({ hasText: 'Aceite' })).toBeVisible();
    await reader.screenshot({ path: '../.factory-results/FEAT-022-invitation-mobile.png', fullPage: true });
    await reader.getByRole('link', { name: 'Consultar rali' }).click();
    await expect(reader.getByRole('heading', { name: rallyName })).toBeVisible();
    const visible = await (await request.get(base + '/api/shared-rallies', { headers: auth })).json() as { id: string }[];
    expect(visible.map(item => item.id)).toEqual([rally.id]);
    expect((await request.put(base + '/api/rallies/' + rally.id, { headers: auth, data: { name: 'Não permitido' } })).status()).toBe(403);
  } finally {
    await reader.close();
  }
});
