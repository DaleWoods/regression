/**
 * Mini-cart drawer — the slide-out panel shown after adding an item to the bag.
 */
import type { Locator, Page } from '@playwright/test';
import { MINI_CART } from '../utils/selectors.js';

export class MiniCart {
  private readonly page: Page;
  private readonly heading: Locator;
  private readonly viewBagButton: Locator;
  private readonly lineItems: Locator;

  constructor(page: Page) {
    this.page = page;
    // [VERIFIED] Drawer heading reads "Your Shopping Bag"; the CTA reads
    // "View Shopping Bag". Both confirmed against Goldsmiths UAT.
    this.heading = page.getByRole('heading', { name: MINI_CART.headingPattern }).first();
    this.viewBagButton = page
      .getByRole('link', { name: MINI_CART.viewBagPattern })
      .or(page.getByRole('button', { name: MINI_CART.viewBagPattern }))
      .first();
    // TODO: confirm the line-item container class inside the drawer.
    this.lineItems = page.locator('[class*="miniCart"] [class*="entry"]');
  }

  /**
   * Waits for the drawer to be open and settled.
   *
   * The drawer animates in, and a click landed mid-animation is silently
   * dropped, so this waits for the CTA to be stable rather than merely present.
   */
  public async waitUntilOpen(timeout = 15_000): Promise<void> {
    await this.viewBagButton.waitFor({ state: 'visible', timeout });
  }

  /** Whether the drawer is currently open. */
  public async isOpen(): Promise<boolean> {
    return (await this.heading.isVisible()) || (await this.viewBagButton.isVisible());
  }

  /**
   * Clicks "View Shopping Bag", navigating to the cart page.
   *
   * Returns void rather than a CartPage because constructing page objects is
   * the fixtures' job — the spec receives `cartPage` already wired up.
   */
  public async viewShoppingBag(): Promise<void> {
    await this.waitUntilOpen();
    await this.viewBagButton.click();
  }

  /** Number of line items shown in the drawer. */
  public async getItemCount(): Promise<number> {
    return this.lineItems.count();
  }

  /** Closes the drawer without navigating. */
  public async close(): Promise<void> {
    // TODO: confirm the close control. Escape is the documented Spartacus
    // behaviour for the overlay and is used until the button is verified.
    await this.page.keyboard.press('Escape');
    await this.viewBagButton.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  }
}
