/**
 * Signed-in customer account area — order history, details and address book.
 */
import type { Locator, Page } from '@playwright/test';
import type { SiteConfig } from '../../../config/types.js';
import { BasePage } from '../BasePage.js';

export class AccountPage extends BasePage {
  private readonly heading: Locator;
  private readonly signOutLink: Locator;
  private readonly orderHistoryLink: Locator;
  private readonly orderRows: Locator;
  private readonly wishlistLink: Locator;

  constructor(page: Page, site: SiteConfig) {
    super(page, site);

    this.heading = page.getByRole('heading', { level: 1 }).first();
    // TODO: confirm accessible names in the account navigation.
    this.signOutLink = page.getByRole('link', { name: /sign out|log out/i }).first();
    this.orderHistoryLink = page.getByRole('link', { name: /order history|my orders/i }).first();
    this.wishlistLink = page.getByRole('link', { name: /wish ?list|saved items/i }).first();
    // TODO: confirm the order history row container.
    this.orderRows = page.locator('[class*="orderHistory"] tbody tr, [class*="order-item"]');
  }

  protected get path(): string {
    // TODO: confirm the account landing path.
    return '/my-account';
  }

  /** The account page heading. */
  public async getHeading(): Promise<string> {
    return (await this.heading.innerText()).trim();
  }

  /** Whether the customer appears to be signed in. */
  public async isSignedIn(): Promise<boolean> {
    return this.signOutLink.isVisible();
  }

  /** Navigates to order history. */
  public async goToOrderHistory(): Promise<void> {
    await this.orderHistoryLink.click();
  }

  /** Navigates to the wishlist / saved items. */
  public async goToWishlist(): Promise<void> {
    await this.wishlistLink.click();
  }

  /** Number of orders listed in order history. */
  public async getOrderCount(): Promise<number> {
    return this.orderRows.count();
  }

  /**
   * The order reference of the most recent order, or null when there are none.
   *
   * Used by ERP tests that need the reference of an order they just placed.
   */
  public async getLatestOrderReference(): Promise<string | null> {
    if ((await this.orderRows.count()) === 0) return null;
    // TODO: confirm which cell holds the order reference; the first cell is the
    // convention but has not been verified.
    return (await this.orderRows.first().locator('td').first().innerText()).trim();
  }

  /** Signs the customer out. */
  public async signOut(): Promise<void> {
    await this.signOutLink.click();
  }
}
