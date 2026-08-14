/**
 * Environment + site URL matrix (spec §5).
 *
 * Phase 1 targets UAT only, but nothing here is UAT-specific: the environment
 * name selects which set of env vars is read, so adding `dev` or a second
 * staging tier is a `.env` change plus a blocklist review, not a refactor.
 *
 * Everything this module returns has already passed the production guard.
 */
import { currentEnvironment, optionalEnv, requireEnv } from './env.js';
import { assertNotProduction } from './productionGuard.js';
import { goldsmithsConfig } from './sites/goldsmiths.js';
import { mappinWebbConfig } from './sites/mappin-webb.js';
import { watchesOfSwitzerlandConfig } from './sites/watches-of-switzerland.js';
import type { EnvironmentConfig, ErpConfig, SiteConfig, SiteKey } from './types.js';

export type { SiteConfig, SiteKey, ErpConfig, EnvironmentConfig } from './types.js';

/** Every site key, in the order projects should appear in reports. */
export const ALL_SITE_KEYS: readonly SiteKey[] = ['goldsmiths', 'mappin-webb', 'wos'];

/**
 * Resolves one site's configuration.
 *
 * Called by the `site` fixture for whichever project is running, and by
 * `playwright.config.ts` when building the project list.
 */
export function getSiteConfig(key: SiteKey): SiteConfig {
  switch (key) {
    case 'goldsmiths':
      return goldsmithsConfig();
    case 'mappin-webb':
      return mappinWebbConfig();
    case 'wos':
      return watchesOfSwitzerlandConfig();
  }
}

/** Resolves all three site configurations. */
export function getAllSiteConfigs(): Record<SiteKey, SiteConfig> {
  return {
    goldsmiths: getSiteConfig('goldsmiths'),
    'mappin-webb': getSiteConfig('mappin-webb'),
    wos: getSiteConfig('wos'),
  };
}

/**
 * Resolves the SAP Webgui ERP connection (spec §9).
 *
 * Credentials are required rather than optional: an ERP run that starts without
 * them fails on the logon screen in a way that reads like a locator bug.
 */
export function getErpConfig(): ErpConfig {
  const baseUrl = requireEnv(
    'ERP_BASE_URL',
    'SAP GUI for HTML (Webgui) entry point on the QA instance, ' +
      'e.g. https://sapqa.example.com/sap/bc/gui/sap/its/webgui'
  );

  // §9.1 non-negotiable: the guard must cover the ERP host explicitly.
  assertNotProduction(baseUrl, 'ERP (SAP Webgui) base URL');

  return {
    baseUrl,
    client: requireEnv('ERP_CLIENT', 'SAP client number, e.g. 100'),
    user: requireEnv('ERP_USER', 'SAP QA user name'),
    password: requireEnv('ERP_PASSWORD', 'SAP QA user password'),
    language: optionalEnv('ERP_LANGUAGE', 'EN'),
  };
}

/**
 * Resolves the full environment. Used by global setup to validate everything
 * up front; individual fixtures resolve only what they need.
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    name: currentEnvironment(),
    sites: getAllSiteConfigs(),
    erp: getErpConfig(),
  };
}
