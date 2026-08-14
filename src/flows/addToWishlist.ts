/**
 * Adds a product to the signed-in customer's wishlist (spec §7).
 *
 * Assertion-free setup. Used by tests that need a populated wishlist without
 * making wishlist-adding the thing under test.
 */
import type { Page } from '@playwright/test';
import type { SiteConfig } from '../../config/types.js';
import { getProduct, isPlaceholder, type ProductCharacteristic } from '../data/products.js';
import { PdpPage } from '../pages/storefront/PdpPage.js';

export interface AddToWishlistOptions {
  page: Page;
  site: SiteConfig;
  /** Which fixed product to save. Defaults to a simple in-stock item. */
  productCharacteristic?: ProductCharacteristic;
}

/**
 * Saves a product to the wishlist and returns the SKU that was saved.
 *
 * Requires an already signed-in session — sign in first via `registerAccount`
 * plus `LoginPage`, or a storage-state fixture.
 */
export async function addToWishlist(options: AddToWishlistOptions): Promise<string> {
  const { page, site, productCharacteristic = 'inStockSimple' } = options;

  if (!site.features.wishlist) {
    throw new Error(
      `addToWishlist was called for ${site.displayName}, which has the wishlist feature ` +
        `disabled in its site config. Guard the calling test with test.skip() instead (spec §4).`
    );
  }

  const product = getProduct(site.key, productCharacteristic);
  if (isPlaceholder(product)) {
    throw new Error(
      `DATA INTEGRITY: the "${productCharacteristic}" product for ${site.displayName} is still a ` +
        `placeholder (sku "${product.sku}"). Confirm the real UAT SKU in src/data/products.ts.`
    );
  }

  const pdpPage = new PdpPage(page, site);
  await pdpPage.gotoProduct(product.path);

  // TODO: confirm the wishlist control on PDP. It is an icon button whose
  // accessible name has not been verified; `getByRole` with a name pattern is
  // the right approach once the real name is known.
  await page
    .getByRole('button', { name: /add to wish ?list|save for later/i })
    .first()
    .click();

  return product.sku;
}
