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
  await page.getByLabel('Email', { exact: true }).fill(email); await page.getByRole('button', { name: 'Pedir email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Se o pedido for aplicável');
  const verification = await proof('VERIFY');
  await page.goto(`/verify-email#token=${verification}`); await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByLabel('Nova password', { exact: true }).fill(password); await page.getByLabel('Confirmar password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Confirmar password', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Email confirmado');
  await page.getByRole('link', { name: 'Voltar ao login' }).click(); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
  const account = page.locator('app-personal-account'); await expect(account).toContainText('Email verificado'); await expect(account).toContainText('Escolhe uma tripulação');
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
  await page.getByRole('link', { name: 'Voltar ao login' }).click(); await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(replacement); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/); await expect(account).toContainText('Email verificado');
});
