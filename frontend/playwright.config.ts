import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';

// Inherited by workers and the test-only backend; never a default production credential.
process.env['RECCE_E2E_PASSWORD'] ||= randomBytes(24).toString('hex');

export default defineConfig({
  testDir: './e2e',
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  globalTimeout: 300_000,
  reporter: [['list'], ['html', { outputFolder: '../.factory-results/e2e/report', open: 'never' }]],
  outputDir: '../.factory-results/e2e/artifacts',
  use: {
    baseURL: 'http://127.0.0.1:18766',
    browserName: 'chromium',
    launchOptions: { executablePath: process.env['CHROME_BIN'] || undefined },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    { command: 'node ../tools/start-e2e-backend.mjs', url: 'http://127.0.0.1:18765/health',
      reuseExistingServer: false, timeout: 180_000, stdout: 'ignore', stderr: 'pipe' },
    { command: 'node ../tools/start-e2e-frontend.mjs', url: 'http://127.0.0.1:18766/login',
      env: { FRONTEND_HOST: '127.0.0.1', PORT: '18766', API_BASE_URL: 'http://127.0.0.1:18765' },
      reuseExistingServer: false, timeout: 120_000, stdout: 'ignore', stderr: 'pipe' },
  ],
});
