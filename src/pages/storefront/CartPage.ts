/**
 * Shopping bag (cart) page — line items, totals and the checkout entry point.
 */
import type { Locator, Page } from '@playwright/test';
import type { SiteConfig } from '../../../config/types.js';
import { Header } from '../../components/Header.js';
import { CART } from '../../utils/selectors.js';
import { BasePage } from '../BasePage.js';

export class CartPage extends BasePage {
  public readonly header: Header;

  private readonly heading: Locator;
  private readonly checkoutButton: Locator;
  private readonly lineItems: Locator;
  private readonly orderTotal: Locator;
  private readonly emptyBagMessage: Locator;

  constructor(page: Page, site: SiteConfig) {
    super(page, site);
    this.header = new Header(page);

    // [VERIFIED] Heading copy ("Shopping Bag") and CTA copy ("Checkout Securely")
    // confirmed against Goldsmiths UAT.
    this.heading = page.getByRole('heading', { name: CART.headingPattern }).first();
    this.checkoutButton = page
      .getByRole('button', { name: CART.checkoutCtaPattern })
      .or(page.getByRole('link', { name: CART.checkoutCtaPattern }))
      .first();

    // TODO: confirm the line-item row container class.
    this.lineItems = page.locator('[class*="cartItem"], [class*="entry-item"]');
    // TODO: confirm the totals block. Matching on the label is closer to how a
    // user reads the page than guessing a class name.
    this.orderTotal = page.getByText(/^total/i).first();
    this.emptyBagMessage = page.getByText(/your (shopping )?bag is empty/i).first();
  }

  protected get path(): string {
    // [VERIFIED] bag link href confirmed as /shopping-bag.
    return '/shopping-bag';
  }

  /** The bag page is ready once its heading has rendered. */
  public override async waitUntilReady(): Promise<void> {
    await super.waitUntilReady();
    await this.heading.waitFor({ state: 'visible', timeout: 20_000 });
  }

  /** Number of line items in the bag. */
  public async getItemCount(): Promise<number> {
    return this.lineItems.count();
  }

  /** Whether the bag is empty. */
  public async isEmpty(): Promise<boolean> {
    return this.emptyBagMessage.isVisible();
  }

  /** The order total as displayed. */
  public async getTotal(): Promise<string> {
    return (await this.orderTotal.innerText()).trim();
  }

  /** Proceeds to checkout. */
  public async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }

  /**
   * Removes the line item at `index`.
   *
   * TODO: confirm the remove control — it is an icon button whose accessible
   * name has not been checked.
   */
  public async removeItem(_index: number): Promise<void> {
    throw new Error(
      'CartPage.removeItem is not implemented: the remove control has not been confirmed in the real DOM.'
    );
  }

  /**
   * Sets the quantity of the line item at `index`.
   *
   * TODO: confirm whether quantity is a stepper or a free-text input.
   */
  public async setQuantity(_index: number, _quantity: number): Promise<void> {
    throw new Error(
      'CartPage.setQuantity is not implemented: the quantity control has not been confirmed in the real DOM.'
    );
  }
}
