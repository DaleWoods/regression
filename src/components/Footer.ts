/**
 * Site footer — secondary navigation, newsletter signup and legal links.
 */
import type { Locator, Page } from '@playwright/test';

export class Footer {
  private readonly root: Locator;
  private readonly newsletterEmailInput: Locator;

  constructor(page: Page) {
    // The footer is a contentinfo landmark on all three sites.
    this.root = page.getByRole('contentinfo').first();
    // TODO: confirm locator — newsletter signup markup has not been inspected.
    this.newsletterEmailInput = this.root.getByRole('textbox', { name: /email/i }).first();
  }

  /** Clicks a footer link by its visible text. */
  public async clickLink(name: string | RegExp): Promise<void> {
    await this.root.getByRole('link', { name }).first().click();
  }

  /** Enters an email address into the newsletter signup field. */
  public async enterNewsletterEmail(email: string): Promise<void> {
    await this.newsletterEmailInput.fill(email);
  }

  /** Scrolls the footer into view — it is lazily rendered on long PLPs. */
  public async scrollIntoView(): Promise<void> {
    await this.root.scrollIntoViewIfNeeded();
  }

  /** Whether the footer is rendered. */
  public async isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }
}
