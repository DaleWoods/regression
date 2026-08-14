/**
 * Site fixture — resolves which storefront the current project is running
 * against and exposes its typed configuration (spec §4).
 *
 * This is what makes "write once, run against all three sites" work: the site
 * key travels in the Playwright project's `use` block, and every page object
 * gets its configuration from here rather than from an import.
 */
import { test as base } from '@playwright/test';
import { getSiteConfig } from '../../config/environments.js';
import type { SiteConfig, SiteKey } from '../../config/types.js';

/** Options set per project in playwright.config.ts. */
export interface SiteOptions {
  /** Which storefront this project targets. Set via `use: { siteKey: ... }`. */
  siteKey: SiteKey;
}

/** Fixtures this module contributes. */
export interface SiteFixtures {
  /** The resolved, production-guarded configuration for the current site. */
  site: SiteConfig;
}

export const siteTest = base.extend<SiteOptions & SiteFixtures>({
  // Declared as an option so each project sets it; the default is never used in
  // practice but keeps the type honest and makes a mis-configured project fail
  // loudly rather than silently running Goldsmiths three times.
  siteKey: ['goldsmiths', { option: true }],

  site: async ({ siteKey }, use) => {
    await use(getSiteConfig(siteKey));
  },
});
