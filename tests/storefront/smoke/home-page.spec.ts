/**
 * Home page smoke — proves the config, fixture and page-object layers work
 * end-to-end against all three sites (spec §14 step 5).
 */
import { test, expect } from '../../../src/fixtures/test.js';

test.describe('Home page', () => {
  test('should load with the site header and no cookie banner blocking @smoke', async ({
    homePage,
    header,
    cookieBanner,
  }) => {
    await homePage.goto();

    // The header rendering is the proof that the storefront actually served the
    // page — a maintenance page or a 404 would not have it.
    await expect(header.locator).toBeVisible();

    // BasePage.goto dismisses the OneTrust banner; if it is still up, every
    // subsequent click in every test would be intercepted.
    await expect(cookieBanner.locator).toBeHidden();
  });

  test('should resolve to the configured site @smoke', async ({ homePage, site }) => {
    await homePage.goto();

    // Confirms the project → siteKey → SiteConfig → baseURL chain is wired up,
    // which is the mechanism the whole multi-site design rests on.
    expect(homePage.url()).toContain(new URL(site.baseUrl).hostname);
  });

  test('should have a non-empty page title @smoke', async ({ homePage }) => {
    await homePage.goto();
    expect((await homePage.title()).trim()).not.toBe('');
  });
});
