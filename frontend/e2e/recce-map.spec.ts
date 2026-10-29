import { test, expect } from '@playwright/test';

test('FEAT-003 satellite route, labeled notes and video remain synchronized across seek, offset and reload', async ({ page, request }) => {
  const password = process.env['RECCE_E2E_PASSWORD'];
  if (!password) throw new Error('Missing ephemeral fixture password');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.invalid');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/pecs$/);
  const token = await page.evaluate(() => localStorage.getItem('recce_auth_token'));
  const headers = { Authorization: `Bearer ${token}` };
  const api = 'http://127.0.0.1:18765/api';
  const rallyResponse = await request.post(`${api}/rallies`, { headers,
    data: { name: 'Map fixture', year: 2026, location: 'Fixture', surface: 'TERRA' } });
  expect(rallyResponse.ok()).toBeTruthy();
  const rally = await rallyResponse.json();
  const pecResponse = await request.post(`${api}/rallies/${rally.id}/pecs`, { headers,
    data: { name: 'Video/GPS fixture', number: 1, distanceKm: 1 } });
  expect(pecResponse.status()).toBe(201);
  const pec = await pecResponse.json();
  const sync = await request.post(`${api}/offline-recces/sync`, { headers, data: {
    sessionId: `map-${pec.id}`, pecId: pec.id, markers: [
      { index: 1, timestamp: 0, latitude: 38.7, longitude: -9.1, text: 'D6' },
      { index: 2, timestamp: 1, latitude: 38.7001, longitude: -9.1001, text: 'D6 > E3' },
    ], gpsTrack: [
      { lat: 38.7, lng: -9.1, timestamp: 0, accuracy: 5 },
      { lat: 38.70001, lng: -9.10001, timestamp: 0.1, accuracy: 5 },
      { lat: 38.7001, lng: -9.1001, timestamp: 1, accuracy: 5 },
      { lat: 38.7002, lng: -9.1002, timestamp: 2, accuracy: 5 },
    ],
  } });
  expect(sync.ok()).toBeTruthy();
  // Generate a real, decodable short WebM locally; no external media fixture or API mocking.
  const videoBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
    const context = canvas.getContext('2d')!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const finished = new Promise<Blob>(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); });
    let frame = 0;
    const timer = setInterval(() => { context.fillStyle = frame++ % 2 ? '#113355' : '#557799'; context.fillRect(0, 0, 160, 90); }, 100);
    recorder.start();
    await new Promise(resolve => setTimeout(resolve, 2500));
    recorder.stop(); clearInterval(timer);
    const blob = await finished;
    stream.getTracks().forEach(track => track.stop());
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const videoUpload = await request.post(`${api}/pecs/${pec.id}/video`, { headers,
    multipart: { file: { name: 'timeline.webm', mimeType: 'video/webm', buffer: Buffer.from(videoBytes) } } });
  expect(videoUpload.ok()).toBeTruthy();

  let blockTiles = false;
  const tileAuth: (string | undefined)[] = [];
  await page.route('https://services.arcgisonline.com/**', async route => {
    tileAuth.push(route.request().headers()['authorization']);
    if (blockTiles) await route.abort(); else await route.continue();
  });
  await page.goto(`/recce/${pec.id}`);
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.leaflet-control-attribution')).toContainText('Esri');
  await expect(page.locator('.recce-map-note')).toHaveCount(2);
  await expect(page.locator('.recce-map-note').filter({ hasText: 'D6 > E3' })).toBeVisible();
  const video = page.locator('video');
  await expect(video).toBeVisible();
  expect((await video.boundingBox())!.height, 'The map must not collapse the video').toBeGreaterThan(100);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2);
  await page.locator('.studio-tools > details').filter({ has: page.locator('summary', { hasText: /^Sincronização$/ }) }).locator('summary').click();
  await page.getByLabel('Desfasamento vídeo/reconhecimento (s)', { exact: true }).fill('0.2');
  const saved = page.waitForResponse(response => response.url() === `${api}/pecs/${pec.id}` && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Guardar sincronização', exact: true }).click();
  expect((await saved).status()).toBe(200);
  const position = page.getByTestId('gps-position');
  await video.evaluate((element: HTMLVideoElement) => { element.pause(); element.currentTime = 1.2; });
  await expect.poll(async () => Number(await position.getAttribute('data-lat'))).toBeCloseTo(38.7001, 5);
  await expect(page.locator('.recce-map-note.is-active')).toHaveText('D6 > E3');
  await video.evaluate((element: HTMLVideoElement) => { element.currentTime = 0.3; });
  await expect.poll(async () => Number(await position.getAttribute('data-lat'))).toBeCloseTo(38.70001, 5);
  await expect(page.locator('.recce-map-note.is-active')).toHaveText('D6');
  await page.locator('.recce-map-note').filter({ hasText: 'D6 > E3' }).click();
  await video.evaluate((element: HTMLVideoElement) => element.pause());
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThanOrEqual(1.19);

  await page.getByRole('button', { name: 'Expandir mapa', exact: true }).click();
  await expect(page.locator('.recce-map.expanded')).toBeVisible();
  await page.screenshot({ path: '../.factory-results/FEAT-003-expanded-map.png', fullPage: true });
  const scale = page.locator('.leaflet-control-scale-line');
  const originalScale = await scale.textContent();
  blockTiles = true;
  await page.getByRole('button', { name: 'Aumentar zoom', exact: true }).click();
  await expect(scale).not.toHaveText(originalScale!);
  await expect(page.getByText('Algumas imagens de satélite não carregaram.', { exact: false })).toBeVisible();
  await expect(page.locator('.recce-map-note')).toHaveCount(2);
  await page.getByRole('button', { name: 'Diminuir zoom', exact: true }).click();
  await page.getByRole('button', { name: 'Enquadrar traçado', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.recce-map.expanded')).toHaveCount(0);
  expect(tileAuth.length).toBeGreaterThan(0);
  expect(tileAuth.every(value => value === undefined), 'Map imagery must never receive API credentials').toBeTruthy();
  blockTiles = false;
  await page.reload();
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await expect(page.getByLabel('Desfasamento vídeo/reconhecimento (s)', { exact: true })).toHaveValue('0.2');
  await expect(page.locator('.recce-map-note')).toHaveCount(2);
  await page.locator('app-recce-map').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../.factory-results/FEAT-003-studio-map.png', fullPage: true });
});
