/**
 * Storefront home page — the site root for all three brands.
 */
import type { Locator, Page } from '@playwright/test';
import type { SiteConfig } from '../../../config/types.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CATEGORY_PATHS } from '../../utils/selectors.js';
import { BasePage } from '../BasePage.js';

export class HomePage extends BasePage {
  public readonly header: Header;
  public readonly footer: Footer;

  private readonly heroBanner: Locator;

  constructor(page: Page, site: SiteConfig) {
    super(page, site);
    this.header = new Header(page);
    this.footer = new Footer(page);
    // The hero carousel is the first main-region banner. Scoped to `main` so it
    // cannot accidentally match a header promo strip.
    // TODO: confirm a stable hook for the hero. Until then readiness is proven
    // by the header landmark, which is verified.
    this.heroBanner = page.getByRole('main').locator('[class*="banner"]').first();
  }

  protected get path(): string {
    return '/';
  }

  /**
   * The home page is ready once the header landmark has rendered. Spartacus
   * streams CMS slots in after hydration, so waiting on the full main region
   * would be both slower and flakier than waiting on the chrome.
   */
  public override async waitUntilReady(): Promise<void> {
    await super.waitUntilReady();
    await this.header.isVisible();
  }

  /** Navigates to the top-level Watches category via the main navigation. */
  public async goToWatches(): Promise<void> {
    await this.header.openNavCategory('Watches');
  }

  /**
   * Navigates directly to a category listing page.
   *
   * Direct navigation rather than menu-walking, because as a *setup* step the
   * mega-menu is not what is under test and its hover behaviour is the single
   * flakiest interaction on the site.
   */
  public async gotoCategory(path: string = CATEGORY_PATHS.mensWatches): Promise<void> {
    await this.goto(path);
  }

  /** Whether the hero banner rendered — for a spec that asserts on it. */
  public async isHeroVisible(): Promise<boolean> {
    return this.heroBanner.isVisible();
  }
}
