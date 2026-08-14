/**
 * Site header — primary navigation, search, account and bag entry points.
 * Shared across every storefront page.
 */
import type { Locator, Page } from '@playwright/test';
import { MINI_CART } from '../utils/selectors.js';

export class Header {
  private readonly root: Locator;
  private readonly bagLink: Locator;
  private readonly searchInput: Locator;
  private readonly accountLink: Locator;

  constructor(page: Page) {
    // Semantic first (spec §6): the header is a banner landmark on all three sites.
    this.root = page.getByRole('banner').first();
    // [VERIFIED] bag link href confirmed on Goldsmiths UAT.
    this.bagLink = page.locator(MINI_CART.bagLink).first();
    // TODO: confirm the search input's accessible name on each site. `searchbox`
    // is the correct role but the name may differ ('Search', 'Search products').
    this.searchInput = page.getByRole('searchbox').first();
    // TODO: confirm locator — the account entry point may be an icon-only link
    // whose accessible name needs checking on each site.
    this.accountLink = page.getByRole('link', { name: /account|sign in/i }).first();
  }

  /** Opens a top-level navigation category by its visible name, e.g. 'Watches'. */
  public async openNavCategory(name: string): Promise<void> {
    await this.root.getByRole('link', { name, exact: true }).first().click();
  }

  /** Clicks the bag icon, which opens the mini-cart drawer. */
  public async openBag(): Promise<void> {
    await this.bagLink.click();
  }

  /** Types a term into site search and submits it. */
  public async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
  }

  /** Navigates to the account area / sign-in entry point. */
  public async openAccount(): Promise<void> {
    await this.accountLink.click();
  }

  /** The bag item-count badge text, or null when no badge is rendered. */
  public async getBagCount(): Promise<string | null> {
    // TODO: confirm the badge element. Spartacus usually renders a count span
    // inside the bag link; left as a scoped text read until the DOM is checked.
    const badge = this.bagLink.locator('[class*="count"]').first();
    return (await badge.isVisible()) ? badge.innerText() : null;
  }

  /**
   * The header's root locator, exposed so specs can use web-first assertions
   * (`await expect(header.locator).toBeVisible()`), which auto-retry. Prefer
   * this over the boolean getter below when asserting.
   */
  public get locator(): Locator {
    return this.root;
  }

  /** Whether the header is rendered — useful as a page-loaded signal. */
  public async isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }
}
