import { test, expect, Page } from '@playwright/test';

const noDeviceCalls = { gps: 0, media: 0, speech: 0, recorder: 0, audio: 0, idbWrites: 0 };

async function safetyProbes(page: Page) {
  await page.addInitScript(() => {
    const calls = { gps: 0, media: 0, speech: 0, recorder: 0, audio: 0, idbWrites: 0 };
    Reflect.set(window, '__workflowCalls', calls);
    const forbidden = (name: keyof typeof calls) => () => { calls[name]++; throw new Error(`Tutorial must not access ${name}`); };
    if (navigator.geolocation) {
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', { configurable: true, value: forbidden('gps') });
      Object.defineProperty(navigator.geolocation, 'watchPosition', { configurable: true, value: forbidden('gps') });
    }
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: forbidden('media') });
    for (const [key, counter] of [['SpeechRecognition', 'speech'], ['webkitSpeechRecognition', 'speech'], ['MediaRecorder', 'recorder'], ['AudioContext', 'audio']] as const) {
      Object.defineProperty(window, key, { configurable: true, value: function() { calls[counter]++; throw new Error(`Tutorial must not construct ${key}`); } });
    }
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(...args: Parameters<IDBDatabase['transaction']>) {
      if (args[1] === 'readwrite') calls.idbWrites++;
      return Reflect.apply(original, this, args);
    };
  });
}

for (const scenario of [
  { key: 'rally', name: 'Criar um rali', count: 5 },
  { key: 'pec', name: 'Criar uma PEC', count: 5 },
  { key: 'recce', name: 'Reconhecimento', count: 6 },
  { key: 'studio', name: 'Studio', count: 7 },
  { key: 'team', name: 'Perfil da Equipa', count: 6 },
  { key: 'offline', name: 'Reconhecimentos offline', count: 7 },
]) {
  test(`${['team', 'offline'].includes(scenario.key) ? 'FEAT-012' : 'FEAT-011'} ${scenario.key}: complete, reverse, reload, keyboard/mobile and preserve real data`, async ({ page, request }) => {
    await safetyProbes(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
    await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/pecs$/);
    await page.getByRole('link', { name: 'Tutorial', exact: true }).click();
    const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
    const headers = { Authorization: `Bearer ${token}` };
    const api = 'http://127.0.0.1:18765/api';
    async function snapshot() {
      const paths = ['rallies', 'notebook-preferences', 'team-profile'];
      const results: string[] = [];
      for (const path of paths) {
        const response = await request.get(`${api}/${path}`, { headers }); expect(response.ok()).toBeTruthy();
        const body = await response.text(); results.push(body);
        if (path === 'rallies') for (const rally of JSON.parse(body)) {
          const pecs = await request.get(`${api}/rallies/${rally.id}/pecs`, { headers }); expect(pecs.ok()).toBeTruthy(); results.push(await pecs.text());
        }
      }
      return results;
    }
    const before = await snapshot();
    const storage = await page.evaluate(() => [JSON.stringify(localStorage), JSON.stringify(sessionStorage)]);
    const requests: string[] = [], errors: string[] = [];
    page.on('request', req => { if (req.url().startsWith(`${api}/`) && !req.url().endsWith('/auth/validate')) requests.push(`${req.method()} ${req.url()}`); });
    page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('link', { name: `Iniciar tutorial: ${scenario.name}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (let step = 1; step <= scenario.count; step++) {
      await expect(dialog).toContainText(`Passo ${step} de ${scenario.count}`);
      await expect(page.locator('#workflow-tour-title')).toBeFocused();
      await expect(page.locator('.tour-spotlight')).toBeVisible();
      if (scenario.key === 'rally' && step === 2) await expect(page.locator('#rally-name')).toHaveValue('Rali de exemplo');
      if (scenario.key === 'pec' && step === 3) await expect(page.locator('#new-pec-distance')).toHaveValue('8.5');
      if (scenario.key === 'recce' && step === 3) await expect(page.locator('[data-demo="recce-record"]')).toHaveText('FINALIZAR E GUARDAR');
      if (scenario.key === 'studio' && step === 5) await expect(page.locator('[data-demo="studio-map"] circle')).toHaveAttribute('cx', '220');
      if (scenario.key === 'team' && step === 3) await expect(page.locator('[data-demo="team-garage"]')).toContainText('Guardar Carro');
      if (scenario.key === 'offline' && step === 6) await expect(page.locator('[data-demo="offline-error"]')).toContainText('Sessão mantida');
      if (step === scenario.count) await page.screenshot({ path: `../.factory-results/FEAT-011-${scenario.key}-desktop.png`, fullPage: false });
      else await dialog.getByRole('button', { name: 'Próximo passo', exact: true }).click();
    }
    await dialog.getByRole('button', { name: 'Anterior', exact: true }).click();
    await expect(dialog).toContainText(`Passo ${scenario.count - 1} de ${scenario.count}`);
    await dialog.getByRole('button', { name: 'Próximo passo', exact: true }).click();
    if (scenario.key === 'rally') await expect(page.locator('app-pecs-list .interactive-card')).toHaveCount(1);
    if (scenario.key === 'pec') await expect(page.locator('app-rally-detail .interactive-card').filter({ hasText: 'Serra de exemplo' })).toHaveCount(1);
    expect(await page.evaluate(() => Reflect.get(window, '__workflowCalls'))).toEqual(noDeviceCalls);
    await page.setViewportSize({ width: 390, height: 844 }); await page.reload();
    await expect(dialog).toContainText(`Passo 1 de ${scenario.count}`);
    await expect(dialog.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
    const panel = await page.locator('.tour-panel').boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(0); expect(panel!.x + panel!.width).toBeLessThanOrEqual(390); expect(panel!.y + panel!.height).toBeLessThanOrEqual(844);
    for (let at = 0; at < 7; at++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBeTruthy(); }
    await dialog.getByRole('button', { name: 'Próximo passo', exact: true }).click();
    await expect(page.locator('.tour-spotlight')).toBeVisible();
    await page.screenshot({ path: `../.factory-results/FEAT-011-${scenario.key}-mobile.png`, fullPage: false });
    expect(await page.evaluate(() => Reflect.get(window, '__workflowCalls'))).toEqual(noDeviceCalls);
    expect(await page.evaluate(() => [JSON.stringify(localStorage), JSON.stringify(sessionStorage)])).toEqual(storage);
    expect(await snapshot()).toEqual(before); expect(requests).toEqual([]); expect(errors).toEqual([]);
    await page.keyboard.press('Escape'); await expect(page).toHaveURL(/\/tutorial$/);
  });
}

test('FEAT-011 offline guides and invalid routes recover without backend access or example IDs', async ({ page }) => {
  await safetyProbes(page);
  const apiRequests: string[] = [];
  page.on('request', req => { if (req.url().includes('/api/')) apiRequests.push(req.url()); });
  await page.goto('/login'); await page.getByRole('button', { name: 'Entrar em modo offline', exact: true }).click();
  await expect(page).toHaveURL(/\/offline-recces$/);
  await page.getByRole('link', { name: 'Tutorial', exact: true }).click();
  for (const name of ['Criar um rali', 'Criar uma PEC', 'Reconhecimento', 'Studio', 'Perfil da Equipa', 'Reconhecimentos offline']) {
    await page.getByRole('link', { name: `Iniciar tutorial: ${name}`, exact: true }).click();
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    while (await dialog.getByRole('button', { name: 'Próximo passo', exact: true }).count()) {
      await dialog.getByRole('button', { name: 'Próximo passo', exact: true }).click();
    }
    expect(await page.evaluate(() => Reflect.get(window, '__workflowCalls'))).toEqual(noDeviceCalls);
    await dialog.getByRole('button', { name: 'Ir para reconhecimentos offline', exact: true }).click();
    await expect(page).toHaveURL(/\/offline-recces$/);
    await page.getByRole('link', { name: 'Tutorial', exact: true }).click();
  }
  await page.goto('/tutorial/learn/__proto__');
  await expect(page.getByRole('heading', { name: 'Tutorial indisponível', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Voltar aos tutoriais', exact: true }).click();
  await expect(page).toHaveURL(/\/tutorial$/); expect(apiRequests).toEqual([]);
});
