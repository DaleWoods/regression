/**
 * Fixed test-data integrity check (spec §8).
 *
 * If a curated product goes out of stock or is deleted in UAT, tests that use it
 * must fail with a clear DATA INTEGRITY message rather than a confusing
 * assertion failure several steps into a journey. This suite is that early
 * warning: run it before a regression pass, and on the nightly schedule.
 */
import { test, expect } from '../../../src/fixtures/test.js';
import { getAllProductsForSite, isPlaceholder } from '../../../src/data/products.js';

test.describe('Fixed product data', () => {
  test('should have every curated product confirmed rather than a placeholder @data-check', ({
    site,
  }) => {
    const products = getAllProductsForSite(site.key);
    const placeholders = products.filter(isPlaceholder);

    // This test is EXPECTED TO FAIL until the real SKUs are supplied — that is
    // its job. It is the tracked reminder that §15's "confirm the fixed product
    // SKUs per site" is still outstanding, and it turns green the moment the
    // catalogue is filled in.
    expect(
      placeholders.map((product) => product.sku),
      `${placeholders.length} of ${products.length} fixed products for ${site.displayName} are ` +
        `still placeholders. Confirm the real UAT SKUs in src/data/products.ts (spec §8, §15).`
    ).toEqual([]);
  });

  test('should have every curated product still live and in the expected state @data-check', async ({
    site,
    pdpPage,
  }) => {
    const products = getAllProductsForSite(site.key).filter((product) => !isPlaceholder(product));

    test.skip(
      products.length === 0,
      'No confirmed products for this site yet — see the placeholder check above.'
    );

    for (const product of products) {
      await pdpPage.gotoProduct(product.path);

      expect(
        await pdpPage.getProductName(),
        `DATA INTEGRITY: product ${product.sku} on ${site.displayName} no longer shows the ` +
          `expected name. The fixed test data is stale — update src/data/products.ts.`
      ).toContain(product.expectedName);

      expect(
        await pdpPage.hasPrice(),
        `DATA INTEGRITY: product ${product.sku} on ${site.displayName} renders no price, so any ` +
          `test using it will fail for the wrong reason.`
      ).toBe(true);
    }
  });
});
