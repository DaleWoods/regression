/**
 * Registers a fresh customer account (spec §7).
 *
 * Assertion-free by design: this is SETUP for tests about something else. A test
 * that is genuinely about registration should drive `RegisterPage` directly and
 * assert as it goes.
 *
 * When an API shortcut for account creation becomes available, this function is
 * the single place it gets swapped in — callers do not change.
 */
import type { Page } from '@playwright/test';
import type { SiteConfig } from '../../config/types.js';
import { createUser, type GeneratedUser } from '../data/userFactory.js';
import { RegisterPage } from '../pages/storefront/RegisterPage.js';
import { recordCreatedAccount } from '../utils/runArtifacts.js';

export interface RegisterAccountOptions {
  page: Page;
  site: SiteConfig;
  /** Test title, recorded against the created account for traceability. */
  testTitle: string;
  /** Overrides for the generated user, e.g. a fixed last name. */
  overrides?: Partial<GeneratedUser>;
}

/**
 * Creates and registers a new account, returning the credentials.
 *
 * The account is recorded to the run artefact so UAT data build-up stays
 * visible even though automated cleanup does not exist yet (§8).
 */
export async function registerAccount(options: RegisterAccountOptions): Promise<GeneratedUser> {
  const { page, site, testTitle, overrides = {} } = options;

  const user = createUser(overrides);
  const registerPage = new RegisterPage(page, site);

  await registerPage.goto();
  await registerPage.register(user);

  recordCreatedAccount(user.email, site.key, testTitle);

  return user;
}
