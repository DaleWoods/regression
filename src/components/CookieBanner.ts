/**
 * OneTrust cookie consent banner — appears on first visit on all three sites.
 */
import type { Locator, Page } from '@playwright/test';
import { COOKIE_BANNER } from '../utils/selectors.js';

export class CookieBanner {
  private readonly acceptButton: Locator;
  private readonly banner: Locator;

  constructor(page: Page) {
    // [VERIFIED] The OneTrust id is present on all three UAT storefronts. The
    // role/name fallback covers the case where OneTrust ships a template change
    // — the button keeps its accessible name even when the id moves.
    this.acceptButton = page
      .locator(COOKIE_BANNER.acceptButtonId)
      .or(page.getByRole('button', { name: /accept all( cookies)?/i }));
    this.banner = page.locator(COOKIE_BANNER.bannerSdk);
  }

  /**
   * Dismisses the banner if it is showing, and does nothing if it is not.
   *
   * Deliberately tolerant: consent state is stored per browser context, so on
   * the second navigation of a test there is no banner and that is not an error.
   */
  public async acceptIfPresent(): Promise<void> {
    const button = this.acceptButton.first();

    const appeared = await button
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!appeared) return;

    await button.click();
    // Wait for the overlay to actually go away — clicking accept starts an
    // animation, and a click issued mid-fade still gets intercepted.
    await this.banner.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  }

  /**
   * The banner's root locator, exposed so specs can use web-first assertions
   * (`await expect(cookieBanner.locator).toBeHidden()`), which auto-retry.
   */
  public get locator(): Locator {
    return this.banner;
  }

  /** Whether the banner is currently visible — for specs that assert on it. */
  public async isVisible(): Promise<boolean> {
    return this.banner.isVisible();
  }
}
