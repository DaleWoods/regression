import { defineConfig } from '@playwright/test';

/**
 * Golden-path coverage against the real app - a fresh SQLite instance,
 * seeded with the demo round, driven through the actual UI. Not a
 * replacement for the server-side unit tests (server/src/**\/*.test.ts),
 * which cover the scoring maths and write-back logic in far more depth
 * than clicking through a browser reasonably can.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: {
      // The sandbox has Chromium pre-installed at a fixed path - use it
      // directly rather than letting Playwright resolve/download its own.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    },
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../server',
      url: 'http://localhost:4000/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        NODE_ENV: 'development',
        PORT: '4000',
        PUBLIC_WEB_ORIGIN: 'http://localhost:5173',
        DB_DRIVER: 'sqlite',
        SQLITE_FILE: './data/e2e.db',
        BOOTSTRAP_ADMIN_EMAIL: 'e2e-admin@example.com',
        BOOTSTRAP_ADMIN_NAME: 'E2E Admin',
        AUTH_MODE: 'email',
        SESSION_SECRET: 'e2e-test-secret-not-for-production',
        SESSION_COOKIE_SECURE: 'false',
        SEED_ON_BOOT: 'demo',
        GRAPH_SEND_ENABLED: 'false',
      },
    },
    {
      command: 'npm run dev',
      cwd: '../web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
