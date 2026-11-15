import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const pilotUrl = pathToFileURL(resolve(__dirname, '../../docs/product/prototypes/p11-commercial-preview.html')).href;

test('FEAT-028 commercial activation and expiry preserve the example access rules', async ({ page }) => {
  const networkRequests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => {
    if (!request.url().startsWith('file:')) networkRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(pilotUrl);

  const model = page.getByRole('group', { name: 'Hipótese a simular' });
  const role = page.getByLabel('Perfil no rali de exemplo');
  const status = page.getByRole('status');
  for (const hypothesis of ['Por rali', 'Anual']) {
    await model.getByRole('radio', { name: hypothesis, exact: true }).check();
    for (const [profile, result] of [
      ['owner', 'Consulta e exportação disponíveis para o proprietário.'],
      ['reader', 'Consulta e exportação disponíveis com a permissão de leitura existente.'],
      ['revoked', 'Consulta e exportação indisponíveis. O acesso continua revogado.'],
      ['outsider', 'Consulta e exportação indisponíveis. É necessária uma permissão de acesso.'],
    ]) {
      await role.selectOption(profile);
      for (const state of ['Ativa', 'Expirada']) {
        await page.getByRole('radio', { name: state, exact: true }).check();
        await expect(status).toContainText(hypothesis + ' · Hipótese ' + state.toLowerCase());
        await expect(status).toContainText(result);
      }
    }
  }
  expect(networkRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('FEAT-028 mobile and keyboard choices are optional and reset without persistence', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(pilotUrl);
  const model = page.getByRole('group', { name: 'Hipótese a simular' });
  const preference = page.getByRole('group', { name: 'Qual escolherias?' });
  await expect(preference.locator(':checked')).toHaveCount(0);
  await model.getByRole('radio', { name: 'Por rali', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(model.getByRole('radio', { name: 'Anual', exact: true })).toBeChecked();
  for (const choice of ['Por rali', 'Anual', 'Nenhum', 'Ainda não sei']) {
    const radio = preference.getByRole('radio', { name: choice, exact: true });
    await radio.check();
    await expect(radio).toBeChecked();
  }
  await page.getByRole('radio', { name: 'Expirada', exact: true }).check();
  await page.getByRole('button', { name: 'Reiniciar simulação' }).click();
  await expect(preference.locator(':checked')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Por rali · Hipótese ativa');
  await preference.getByRole('radio', { name: 'Nenhum', exact: true }).check();
  await page.reload();
  await expect(preference.locator(':checked')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
