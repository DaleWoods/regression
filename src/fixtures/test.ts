/**
 * The extended `test` export — THE ONLY IMPORT SPEC FILES USE (spec §3).
 *
 * Spec files never import a page class directly. They import `test` and `expect`
 * from here and receive fully-wired page objects as fixtures, which is what
 * keeps selectors out of specs and lets a single test run against three sites.
 *
 * Usage:
 *   import { test, expect } from '@fixtures/test';
 *
 *   test('should show a price on the PDP @smoke @browse', async ({ pdpPage, site }) => {
 *     await pdpPage.gotoProduct('/p/123');
 *     expect(await pdpPage.hasPrice()).toBe(true);
 *   });
 */
import { expect, mergeTests } from '@playwright/test';
import { siteTest } from './siteFixture.js';
import { erpTest } from './erpFixture.js';

import { HomePage } from '../pages/storefront/HomePage.js';
import { PlpPage } from '../pages/storefront/PlpPage.js';
import { PdpPage } from '../pages/storefront/PdpPage.js';
import { CartPage } from '../pages/storefront/CartPage.js';
import { CheckoutPage } from '../pages/storefront/CheckoutPage.js';
import { LoginPage } from '../pages/storefront/LoginPage.js';
import { RegisterPage } from '../pages/storefront/RegisterPage.js';
import { AccountPage } from '../pages/storefront/AccountPage.js';

import { Header } from '../components/Header.js';
import { Footer } from '../components/Footer.js';
import { CookieBanner } from '../components/CookieBanner.js';
import { MiniCart } from '../components/MiniCart.js';

/** Storefront page objects available to every spec. */
export interface StorefrontFixtures {
  homePage: HomePage;
  plpPage: PlpPage;
  pdpPage: PdpPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  accountPage: AccountPage;

  header: Header;
  footer: Footer;
  cookieBanner: CookieBanner;
  miniCart: MiniCart;
}

/**
 * Combines the site and ERP fixture sets.
 *
 * Fixtures are lazy: declaring `erpSession` here costs nothing until a spec
 * actually asks for it, so storefront tests never touch SAP.
 */
const baseTest = mergeTests(siteTest, erpTest);

export const test = baseTest.extend<StorefrontFixtures>({
  homePage: async ({ page, site }, use) => {
    await use(new HomePage(page, site));
  },
  plpPage: async ({ page, site }, use) => {
    await use(new PlpPage(page, site));
  },
  pdpPage: async ({ page, site }, use) => {
    await use(new PdpPage(page, site));
  },
  cartPage: async ({ page, site }, use) => {
    await use(new CartPage(page, site));
  },
  checkoutPage: async ({ page, site }, use) => {
    await use(new CheckoutPage(page, site));
  },
  loginPage: async ({ page, site }, use) => {
    await use(new LoginPage(page, site));
  },
  registerPage: async ({ page, site }, use) => {
    await use(new RegisterPage(page, site));
  },
  accountPage: async ({ page, site }, use) => {
    await use(new AccountPage(page, site));
  },

  header: async ({ page }, use) => {
    await use(new Header(page));
  },
  footer: async ({ page }, use) => {
    await use(new Footer(page));
  },
  cookieBanner: async ({ page }, use) => {
    await use(new CookieBanner(page));
  },
  miniCart: async ({ page }, use) => {
    await use(new MiniCart(page));
  },
});

export { expect };

/** Re-exported so specs can type helper functions without a second import. */
export type { SiteConfig, SiteKey } from '../../config/types.js';
