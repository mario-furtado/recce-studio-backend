import { test, expect, Locator } from '@playwright/test';

test('FEAT-014 contextual panels anchor, dismiss, focus and preserve values in desktop/mobile', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(process.env['RECCE_E2E_PASSWORD']!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/pecs$/);
  const api = 'http://127.0.0.1:18765/api';
  const headers = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('recce_auth_token'))}` };
  const rally = await (await request.post(`${api}/rallies`, { headers, data: { name: 'Panel fixture', year: 2026, surface: 'TERRA', location: 'Serra' } })).json();
  const pec = await (await request.post(`${api}/rallies/${rally.id}/pecs`, { headers, data: { name: 'Contexto do Studio', number: 1, distanceKm: 1 } })).json();
  expect((await request.post(`${api}/pecs/${pec.id}/notes`, { headers, data: { text: 'D6 ATT', originalTimestamp: 5 } })).ok()).toBeTruthy();
  await page.goto(`/recce/${pec.id}`); await page.getByRole('button', { name: 'Studio', exact: true }).click();
  const writes: string[] = [];
  page.on('request', req => { if (req.url().includes('/api/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method())) writes.push(req.url()); });
  const details = (name: string) => page.locator('details[appContextPanel]').filter({ has: page.locator('summary', { hasText: new RegExp(`^${name}$`) }) });
  async function positioned(menu: Locator) {
    const trigger = menu.locator(':scope > summary'), panel = menu.locator(':scope > [popover]');
    await expect(panel).toBeVisible(); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const a = (await trigger.boundingBox())!, b = (await panel.boundingBox())!, viewport = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(11); expect(b.x + b.width).toBeLessThanOrEqual(viewport.width - 11);
    expect(b.y).toBeGreaterThanOrEqual(7); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height - 7);
    expect(b.x).toBeLessThanOrEqual(a.x + a.width); expect(b.x + b.width).toBeGreaterThanOrEqual(a.x);
    expect(Math.min(Math.abs(b.y - a.y - a.height), Math.abs(a.y - b.y - b.height))).toBeLessThanOrEqual(13);
    expect(await panel.evaluate(node => node.contains(document.activeElement))).toBeTruthy();
    expect(await panel.evaluate(node => getComputedStyle(node, '::backdrop').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  }
  for (const name of ['Ficheiros', 'Sincronização', 'Opções', 'Ações da PEC']) {
    const menu = details(name); await menu.locator(':scope > summary').click(); await positioned(menu);
    await page.keyboard.press('Escape'); await expect(menu.locator('[popover]')).toBeHidden(); await expect(menu.locator(':scope > summary')).toBeFocused();
  }
  await details('Ficheiros').locator('summary').click(); await details('Sincronização').locator('summary').click();
  await expect(details('Ficheiros').locator('[popover]')).toBeHidden(); await positioned(details('Sincronização'));
  const offset = page.getByLabel('Desfasamento vídeo/reconhecimento (s)', { exact: true }); await offset.fill('1.5');
  await page.getByRole('heading', { name: 'Contexto do Studio', exact: true }).click();
  await expect(details('Sincronização').locator('[popover]')).toBeHidden();
  await details('Sincronização').locator('summary').click(); await expect(offset).toHaveValue('1.5'); await page.keyboard.press('Escape');
  await details('Opções').locator('summary').click(); await page.keyboard.press('Tab');
  await expect(details('Opções').getByRole('link', { name: 'Configurar notas' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(details('Opções').locator('[popover]')).toBeHidden();
  const bookButton = page.getByRole('button', { name: 'Exportar PDF', exact: true });
  await bookButton.click(); const dialog = page.getByRole('dialog', { name: 'Caderno / PDF', exact: true });
  await expect(dialog).toBeVisible(); expect(await dialog.evaluate(node => node.matches(':modal'))).toBeTruthy();
  await expect(dialog.getByRole('heading', { name: 'Caderno / PDF' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Imprimir / Guardar PDF' })).toBeEnabled();
  for (let at = 0; at < 5; at++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBeTruthy(); }
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(bookButton).toBeFocused();
  await bookButton.click(); await page.mouse.click(3, 3); await expect(dialog).toBeHidden(); await expect(bookButton).toBeFocused();
  await details('Sincronização').locator('summary').click(); await positioned(details('Sincronização'));
  await page.screenshot({ path: '../.factory-results/FEAT-014-context-desktop.png', fullPage: false, animations: 'disabled' }); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const name of ['Ficheiros', 'Sincronização']) {
    const menu = details(name); await menu.locator('summary').click(); await positioned(menu);
    await page.keyboard.press('Escape'); await expect(menu.locator('[popover]')).toBeHidden();
  }
  await details('Ficheiros').locator('summary').click(); await positioned(details('Ficheiros'));
  await expect(details('Ficheiros').locator('[popover]')).toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: '../.factory-results/FEAT-014-context-mobile.png', fullPage: false }); await page.keyboard.press('Escape');
  await bookButton.click(); await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('animation-name', 'none');
  const mobileBook = (await dialog.boundingBox())!; expect(mobileBook.x).toBeGreaterThanOrEqual(0); expect(mobileBook.x + mobileBook.width).toBeLessThanOrEqual(360);
  await dialog.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(dialog.getByRole('button', { name: 'Fechar caderno', exact: true })).toBeInViewport();
  const closeBox = (await dialog.getByRole('button', { name: 'Fechar caderno', exact: true }).boundingBox())!;
  expect(closeBox.y).toBeGreaterThanOrEqual(mobileBook.y); expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(mobileBook.y + mobileBook.height);
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  await page.getByRole('navigation', { name: 'Vistas do Studio' }).getByRole('button', { name: 'Notas', exact: true }).click();
  const noteMenu = page.locator('.note-actions details'); await noteMenu.locator('summary').click(); await positioned(noteMenu);
  await noteMenu.getByRole('button', { name: 'Eliminar nota', exact: true }).click();
  await expect(noteMenu.locator('[popover]')).toBeHidden();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('.note-row')).toHaveCount(1); expect(writes).toEqual([]);
});
