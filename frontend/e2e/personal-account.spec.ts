import { test, expect } from '@playwright/test';

test('FEAT-018 personal signup, verification, recovery and workspace isolation', async ({ page, request }) => {
  const api = 'http://127.0.0.1:18765';
  const email = `personal-${Date.now()}@example.invalid`;
  const password = 'Personal-password-2026';
  const replacement = 'Replacement-password-2026';
  async function proof(purpose: string) {
    const response = await request.get(`${api}/e2e/mailbox?email=${encodeURIComponent(email)}`, { headers: { 'X-E2E-Key': process.env['RECCE_E2E_PASSWORD']! } });
    expect(response.status()).toBe(200);
    const messages = await response.json() as { purpose: string; token: string }[];
    return messages.filter(item => item.purpose === purpose).at(-1)!.token;
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login'); await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Criar conta pessoal' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('typo-' + email);
  await page.getByLabel('Nome', { exact: true }).fill('Érica de Ensaio');
  await page.getByLabel('Data de nascimento', { exact: true }).fill('1992-02-29');
  await page.getByLabel('Password', { exact: true }).fill(password); await page.getByLabel('Confirmar password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Enviar código de verificação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verifica o teu email' })).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'Corrigir email' }).click();
  await page.getByLabel('Novo email').fill(email);
  await page.getByRole('button', { name: 'Enviar código', exact: true }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const verification = await proof('VERIFY_CODE');
  await page.getByRole('button', { name: 'Reenviar código' }).click();
  await expect(page.getByRole('status')).toContainText('Pediste um novo código');
  await page.getByLabel('Código de verificação').fill(verification);
  await page.getByRole('button', { name: 'Confirmar email' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar o código');
  await page.getByLabel('Código de verificação').fill(await proof('VERIFY_CODE'));
  await page.getByRole('button', { name: 'Confirmar email' }).click();
  await expect(page.getByRole('status')).toContainText('Email confirmado');
  await expect(page).toHaveURL(/\/login$/);
  expect(await proof('WELCOME')).toBe('');
  await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
  const account = page.locator('app-personal-account'); await expect(account).toContainText('Email verificado'); await expect(account).toContainText('Escolhe uma tripulação');
  await expect(account.getByLabel('Nome', { exact: true })).toHaveValue('Érica de Ensaio');
  await expect(account.getByLabel('Data de nascimento', { exact: true })).toHaveValue('1992-02-29');
  await account.getByLabel('Nome', { exact: true }).fill('Érica Atualizada');
  await account.getByRole('button', { name: 'Guardar dados pessoais' }).click();
  await expect(account.getByText('Dados pessoais guardados.')).toBeVisible();
  await page.reload();
  await expect(account.getByLabel('Nome', { exact: true })).toHaveValue('Érica Atualizada');
  const oldToken = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  expect((await request.get(`${api}/api/rallies`, { headers: { Authorization: `Bearer ${oldToken}` } })).status()).toBe(403);
  await page.goto('/pecs'); await expect(page).toHaveURL(/\/account$/);
  await page.screenshot({ path: '../.factory-results/FEAT-018-personal-desktop.png', fullPage: true });
  await account.getByRole('link', { name: 'Recuperar acesso' }).click(); await page.getByLabel('Email', { exact: true }).fill(email);
  const sent = page.waitForRequest(r => r.url().endsWith('/api/auth/password-reset/request') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Pedir email', exact: true }).click(); expect((await sent).headers()['authorization']).toBeUndefined();
  await expect(page.getByRole('status')).toContainText('Se o pedido for aplicável');
  const recovery = await proof('RESET'); await page.goto(`/reset-password#token=${recovery}`); await expect(page).toHaveURL(/\/reset-password$/);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByLabel('Nova password', { exact: true }).fill(replacement); await page.getByLabel('Confirmar password', { exact: true }).fill('mismatch-password');
  await page.getByRole('button', { name: 'Confirmar password', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('dois campos');
  await page.getByLabel('Confirmar password', { exact: true }).fill(replacement); await page.screenshot({ path: '../.factory-results/FEAT-018-recovery-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole('button', { name: 'Confirmar password', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Password atualizada');
  expect((await request.get(`${api}/api/auth/validate`, { headers: { Authorization: `Bearer ${oldToken}` } })).status()).toBe(401);
  const reused = await request.post(`${api}/api/auth/password-reset/confirm`, { data: { token: recovery, password } }); expect(reused.status()).toBe(400);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(replacement); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/); await expect(account).toContainText('Email verificado');
});

test('FEAT-027 transfers a crew and recovers a deactivated owner', async ({ page, browser, request }) => {
  const api = 'http://127.0.0.1:18765';
  const suffix = Date.now();
  const owner = `transfer-owner-${suffix}@example.invalid`;
  const recipient = `transfer-recipient-${suffix}@example.invalid`;
  const password = 'Lifecycle-password-2026';
  const name = 'Tripulação em transferência';
  async function proof(email: string, purpose: string) {
    const response = await request.get(`${api}/e2e/mailbox`, {
      params: { email }, headers: { 'X-E2E-Key': process.env['RECCE_E2E_PASSWORD']! },
    });
    expect(response.ok()).toBe(true);
    const messages = await response.json() as { purpose: string; token: string }[];
    return messages.filter(item => item.purpose === purpose).at(-1)!.token;
  }
  async function signup(email: string) {
    const registration = await request.post(`${api}/api/auth/register`, { data: {
      email, password, displayName: 'Conta de ensaio', dateOfBirth: '1990-02-28',
    } });
    expect(registration.status()).toBe(202);
    const code = await proof(email, 'VERIFY_CODE');
    expect((await request.post(`${api}/api/auth/registration/confirm`, { data: {
      requestId: (await registration.json()).requestId, code,
    } })).status()).toBe(204);
  }
  async function signIn(tab: typeof page, email: string) {
    await tab.goto('/login');
    await tab.getByLabel('Email', { exact: true }).fill(email);
    await tab.getByLabel('Password', { exact: true }).fill(password);
    await tab.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(tab).toHaveURL(/\/account$/);
  }
  await signup(owner);
  await signup(recipient);
  await signIn(page, owner);
  await page.getByLabel('Nome da nova tripulação').fill(name);
  await page.getByRole('button', { name: 'Criar tripulação', exact: true }).click();
  await page.getByRole('button', { name: `Transferir tripulação ${name}` }).click();
  const outgoing = page.locator('form').filter({ hasText: 'Email do novo proprietário' });
  await outgoing.getByLabel('Email do novo proprietário').fill(recipient);
  await outgoing.getByLabel('Password atual').fill(password);
  await outgoing.getByRole('button', { name: 'Pedir transferência', exact: true }).click();
  await expect(page.locator('app-crew-manager').getByRole('status')).toContainText('Pedido enviado');
  const other = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await signIn(other, recipient);
    await other.getByRole('button', { name: 'Aceitar transferência', exact: true }).click();
    const incoming = other.locator('form').filter({ hasText: 'Confirmar aceitação' });
    await incoming.getByLabel('Password atual').fill(password);
    await incoming.getByRole('button', { name: 'Confirmar aceitação', exact: true }).click();
    await expect(other.getByRole('button', { name: `Abrir tripulação ${name}` })).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Para criares o teu primeiro rali/)).toBeVisible();
    await expect(page.getByRole('button', { name: `Abrir tripulação ${name}` })).toHaveCount(0);
    await other.getByText('Desativar conta', { exact: true }).click();
    await expect(other.getByText(/Os leitores autorizados mantêm acesso/)).toBeVisible();
    await other.getByLabel('Password atual', { exact: true }).fill(password);
    await other.getByRole('button', { name: 'Confirmar desativação', exact: true }).click();
    await expect(other).toHaveURL(/\/login$/);
    expect((await request.post(`${api}/api/auth/password-reset/request`, { data: { email: recipient } })).status()).toBe(202);
    await other.goto(`/reset-password#token=${await proof(recipient, 'RESET')}`);
    await other.getByLabel('Nova password', { exact: true }).fill(password);
    await other.getByLabel('Confirmar password', { exact: true }).fill(password);
    await other.getByRole('button', { name: 'Confirmar password', exact: true }).click();
    await expect(other.getByRole('status')).toContainText('Password atualizada');
    await expect(other).toHaveURL(/\/login$/);
    await signIn(other, recipient);
    await expect(other.getByRole('button', { name: `Abrir tripulação ${name}` })).toBeVisible();
  } finally {
    await other.close();
  }
});
