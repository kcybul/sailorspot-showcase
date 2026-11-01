import { defineConfig, devices } from '@playwright/test';

const externalServer = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 35_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalServer || 'http://127.0.0.1:8097',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'enquiry-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'enquiry-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: externalServer ? undefined : {
    command: 'python3 -m http.server 8097 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8097/plan/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
