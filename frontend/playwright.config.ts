import { defineConfig, devices } from '@playwright/test';

const frontendPort = process.env['PLAYWRIGHT_FRONTEND_PORT'] ?? '4200';
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const simulatorPort = '4301';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: frontendUrl,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `npm --prefix ../backend-simulator run build && PORT=${simulatorPort} npm --prefix ../backend-simulator start`,
      url: `http://127.0.0.1:${simulatorPort}/_simulator/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run start:simulator -- --host 127.0.0.1 --port ${frontendPort} --proxy-config proxy.playwright.json`,
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
