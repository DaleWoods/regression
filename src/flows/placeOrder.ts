/**
 * Places an order end-to-end (spec §7).
 *
 * This exists primarily as a PRECONDITION for ERP tests: dispatch, cancellation
 * and exchange all need an order to exist first, and those tests should not
 * re-walk the checkout UI as part of their own steps.
 *
 * Assertion-free. A test about checkout itself should drive `CheckoutPage`
 * directly and assert at each step.
 *
 * When an API shortcut for order creation becomes available, it is swapped in
 * here and every ERP test gets faster without changing.
 */
import type { Page } from '@playwright/test';
import type { SiteConfig } from '../../config/types.js';
import { createAddress, generateEmail, getTestCard } from '../data/userFactory.js';
import { getProduct, isPlaceholder, type ProductCharacteristic } from '../data/products.js';
import { CartPage } from '../pages/storefront/CartPage.js';
import { CheckoutPage } from '../pages/storefront/CheckoutPage.js';
import { PdpPage } from '../pages/storefront/PdpPage.js';
import { recordCreatedOrder } from '../utils/runArtifacts.js';
import { logger } from '../utils/logger.js';

const log = logger('flow:placeOrder');

export interface PlaceOrderOptions {
  page: Page;
  site: SiteConfig;
  /** Test title, recorded against the created order. */
  testTitle: string;
  /** Which fixed product to buy. Defaults to a simple in-stock item. */
  productCharacteristic?: ProductCharacteristic;
  /** Guest email. Defaults to a freshly generated address. */
  email?: string;
}

export interface PlacedOrder {
  /** Order reference from the confirmation page, when one could be read. */
  orderReference: string | null;
  email: string;
  sku: string;
}

/**
 * Walks browse → add to bag → checkout → pay → confirmation.
 *
 * @throws with a data-integrity message if the chosen fixed product is still a
 *         placeholder, rather than failing later on a 404 PDP (§8).
 */
export async function placeOrder(options: PlaceOrderOptions): Promise<PlacedOrder> {
  const {
    page,
    site,
    testTitle,
    productCharacteristic = 'inStockSimple',
    email = generateEmail(),
  } = options;

  const product = getProduct(site.key, productCharacteristic);

  if (isPlaceholder(product)) {
    throw new Error(
      `DATA INTEGRITY: the "${productCharacteristic}" product for ${site.displayName} is still a ` +
        `placeholder (sku "${product.sku}").\n` +
        `  Confirm the real UAT SKU in src/data/products.ts before running order-placing tests (spec §8, §15).`
    );
  }

  const address = createAddress();
  const card = getTestCard();

  // 1. Product detail page → add to bag.
  const pdpPage = new PdpPage(page, site);
  await pdpPage.gotoProduct(product.path);
  await pdpPage.addToBag();
  await pdpPage.miniCart.viewShoppingBag();

  // 2. Bag → checkout.
  const cartPage = new CartPage(page, site);
  await cartPage.waitUntilReady();
  await cartPage.checkout();

  // 3. Checkout: identify, deliver, pay.
  const checkoutPage = new CheckoutPage(page, site);
  await checkoutPage.continueAsGuest(email);
  await checkoutPage.enterDeliveryDetails({
    title: address.title,
    firstName: 'QA',
    lastName: 'Automation',
    phone: address.phone,
  });
  await checkoutPage.selectAddressByLookup(address.postcode);
  await checkoutPage.confirmAddress();
  await checkoutPage.continueToPayment();

  await checkoutPage.selectCardPayment();
  await checkoutPage.enterCardDetails(card);
  await checkoutPage.placeOrder();

  // 4. Read the reference from the confirmation page.
  const orderReference = await readOrderReference(page);

  if (orderReference !== null) {
    recordCreatedOrder(orderReference, site.key, testTitle, `sku=${product.sku}`);
    log.info(`Placed order ${orderReference} on ${site.displayName}`);
  } else {
    log.warn(`Order placed on ${site.displayName} but no reference could be read`);
  }

  return { orderReference, email, sku: product.sku };
}

/**
 * Reads the order reference from the confirmation page.
 *
 * Returns null rather than throwing: the caller decides whether a missing
 * reference is fatal, and a flow must not assert (§7).
 */
async function readOrderReference(page: Page): Promise<string | null> {
  // [VERIFIED] Confirmation heading copy confirmed; the reference element
  // itself has not been pinned down.
  // TODO: confirm a dedicated hook for the order reference — ideally a
  // data-testid (raise with dev).
  const referenceText = page.getByText(/order (reference|number)/i).first();

  const appeared = await referenceText
    .waitFor({ state: 'visible', timeout: 30_000 })
    .then(() => true)
    .catch(() => false);

  if (!appeared) return null;

  const raw = await referenceText.innerText();
  // Pull the first token that looks like a document number.
  const match = /([A-Z0-9-]{6,})/i.exec(raw.replace(/order (reference|number)/i, ''));
  return match?.[1] ?? null;
}
