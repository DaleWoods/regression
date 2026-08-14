/**
 * PDP smoke — proves a product page renders a price on all three sites
 * (spec §14 step 5).
 *
 * Reaches the PDP by way of the category listing rather than a fixed SKU,
 * because the fixed product SKUs are still an open item (§15). Once the real
 * SKUs are confirmed this should switch to `getProduct(site.key, 'inStockSimple')`,
 * which is both faster and deterministic.
 */
import { test, expect } from '../../../src/fixtures/test.js';
import { CATEGORY_PATHS } from '../../../src/utils/selectors.js';

test.describe('Product detail page', () => {
  test('should display a price for the first listed product @smoke @browse', async ({
    plpPage,
    pdpPage,
  }) => {
    // [VERIFIED] on Goldsmiths. TODO: confirm the equivalent category path on
    // Mappin & Webb and Watches of Switzerland — the taxonomy is believed to be
    // shared, and this test is what will prove or disprove that.
    await plpPage.goto(CATEGORY_PATHS.mensWatches);

    expect(await plpPage.getProductCount()).toBeGreaterThan(0);

    await plpPage.openProduct(0);
    await pdpPage.waitUntilReady();

    expect(await pdpPage.hasPrice()).toBe(true);

    // A rendered but unparseable price is a real defect, not a passing test.
    const price = await pdpPage.getPriceValue();
    expect(Number.isNaN(price)).toBe(false);
    expect(price).toBeGreaterThan(0);
  });

  test('should show a product name as the page heading @smoke @browse', async ({
    plpPage,
    pdpPage,
  }) => {
    await plpPage.goto(CATEGORY_PATHS.mensWatches);
    await plpPage.openProduct(0);
    await pdpPage.waitUntilReady();

    expect((await pdpPage.getProductName()).trim()).not.toBe('');
  });
});
