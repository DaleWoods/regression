/**
 * Playwright configuration (spec §4, §14 step 2).
 *
 * Sites are implemented as PROJECTS. Each project injects its own `siteKey`,
 * which the `site` fixture turns into a typed `SiteConfig`. That is the whole
 * mechanism behind "write a test once, run it against all three sites".
 *
 * Project families:
 *   goldsmiths | mappin-webb | wos          desktop Chromium, the default run
 *   *-mobile                                 mobile viewport, tagged @mobile
 *   erp                                      SAP Webgui — workers: 1, long timeouts
 */
import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { getSiteConfig } from './config/environments.js';
import { isCI, optionalIntEnv } from './config/env.js';
import type { SiteOptions } from './src/fixtures/siteFixture.js';

loadEnv();

/**
 * Base URLs are resolved eagerly so a bad configuration fails while the config
 * is being read, before any test is collected. The production guard runs inside
 * `getSiteConfig`, so this is also the earliest possible point at which a
 * production URL is rejected.
 */
const goldsmiths = getSiteConfig('goldsmiths');
const mappinWebb = getSiteConfig('mappin-webb');
const wos = getSiteConfig('wos');

/** Desktop viewport shared by the three storefront projects. */
const desktopChrome = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };

/** Mobile viewport for the @mobile projects. */
const mobileChrome = devices['Pixel 7'];

export default defineConfig<SiteOptions>({
  testDir: './tests',
  outputDir: './test-results',

  /* Validates env vars and enforces the production guard before anything runs. */
  globalSetup: './config/globalSetup.ts',

  /* Spec §13: no test may be left focused, and CI must not silently pass a
     suite where someone committed `test.only`. */
  forbidOnly: isCI,

  /* Retries in CI only (spec §14 step 2). Locally a flake should be seen and
     fixed, not hidden behind a retry. */
  retries: optionalIntEnv('RETRIES', isCI ? 2 : 0),

  /* Storefront tests parallelise freely; the ERP project overrides this to 1. */
  workers: optionalIntEnv('WORKERS', isCI ? 4 : 6),
  fullyParallel: true,

  /* A single test should never run for more than a minute against the
     storefront; the ERP project raises this substantially. */
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ...(isCI ? ([['github'], ['blob']] as const) : ([] as const)),
  ],

  use: {
    /* Spec §2: trace on first retry, plus screenshot and video on failure. */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    locale: 'en-GB',
    timezoneId: 'Europe/London',
    headless: process.env['HEADED'] !== '1',
  },

  projects: [
    // -----------------------------------------------------------------------
    // Storefront — desktop. The default `npm run test` target.
    // -----------------------------------------------------------------------
    {
      name: 'goldsmiths',
      use: { ...desktopChrome, baseURL: goldsmiths.baseUrl, siteKey: 'goldsmiths' },
      testDir: './tests/storefront',
    },
    {
      name: 'mappin-webb',
      use: { ...desktopChrome, baseURL: mappinWebb.baseUrl, siteKey: 'mappin-webb' },
      testDir: './tests/storefront',
    },
    {
      name: 'wos',
      use: { ...desktopChrome, baseURL: wos.baseUrl, siteKey: 'wos' },
      testDir: './tests/storefront',
    },

    // -----------------------------------------------------------------------
    // Storefront — mobile viewport. Opt-in via `npm run test:mobile`.
    // -----------------------------------------------------------------------
    {
      name: 'goldsmiths-mobile',
      use: { ...mobileChrome, baseURL: goldsmiths.baseUrl, siteKey: 'goldsmiths' },
      testDir: './tests/storefront',
      grep: /@mobile/,
    },
    {
      name: 'mappin-webb-mobile',
      use: { ...mobileChrome, baseURL: mappinWebb.baseUrl, siteKey: 'mappin-webb' },
      testDir: './tests/storefront',
      grep: /@mobile/,
    },
    {
      name: 'wos-mobile',
      use: { ...mobileChrome, baseURL: wos.baseUrl, siteKey: 'wos' },
      testDir: './tests/storefront',
      grep: /@mobile/,
    },

    // -----------------------------------------------------------------------
    // ERP — SAP GUI for HTML (Webgui). Separate project with its own settings.
    //
    // workers: 1 is NON-NEGOTIABLE (spec §9.1). SAP enforces server-side object
    // locks and a per-user concurrent session limit (commonly 6). Parallel
    // workers on one user produce lock errors and "maximum number of sessions"
    // failures that look like test bugs but are not.
    //
    // If parallelism is ever needed, it requires ONE DEDICATED SAP QA USER PER
    // WORKER — not more sessions for one user. Do not build that now (§9.1).
    // -----------------------------------------------------------------------
    {
      name: 'erp',
      testDir: './tests/erp',
      workers: 1,
      fullyParallel: false,
      /* Webgui round trips are slow, and papering over that with waits is
         banned — so the budget itself is raised instead (spec §9.5). */
      timeout: 300_000,
      expect: { timeout: 30_000 },
      use: {
        ...desktopChrome,
        actionTimeout: 60_000,
        navigationTimeout: 120_000,
        /* SAP screens are dense; a larger viewport keeps table controls from
           virtualising away rows the test needs. */
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
