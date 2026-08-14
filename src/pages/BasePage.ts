/**
 * Base class for every storefront page object (spec §6).
 *
 * Provides navigation, cookie-banner dismissal, common waits and a scoped
 * `page` reference. Contains no assertions — those live in specs.
 */
import type { Page } from '@playwright/test';
import type { SiteConfig } from '../../config/types.js';
import { CookieBanner } from '../components/CookieBanner.js';
import { waitForPageReady } from '../utils/waits.js';

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly site: SiteConfig;
  protected readonly cookieBanner: CookieBanner;

  constructor(page: Page, site: SiteConfig) {
    this.page = page;
    this.site = site;
    this.cookieBanner = new CookieBanner(page);
  }

  /**
   * A path fragment identifying this page, used by `goto()` when a page object
   * knows its own URL. Pages reached only by navigation return `null`.
   */
  protected abstract get path(): string | null;

  /**
   * Navigates to a path relative to the site's base URL and settles the page.
   *
   * The cookie banner is dismissed on arrival because OneTrust overlays the
   * viewport and intercepts clicks — every test would otherwise repeat that
   * dance in its own first step.
   *
   * @param path path relative to the site root, e.g. '/c/Watches'. Defaults to
   *             this page's own `path` when it declares one.
   */
  public async goto(path?: string): Promise<void> {
    const target = path ?? this.path;
    if (target === null || target === undefined) {
      throw new Error(
        `${this.constructor.name} has no default path, so goto() needs one passed explicitly. ` +
          `Pages reached only by navigation should be returned from the action that navigates to them.`
      );
    }

    await this.page.goto(target, { waitUntil: 'domcontentloaded' });
    await this.cookieBanner.acceptIfPresent();
    await this.waitUntilReady();
  }

  /**
   * Waits until the page is interactive. Subclasses override to add a
   * page-specific readiness signal (a heading, a grid, a form) — the base
   * implementation only covers document readiness.
   */
  public async waitUntilReady(): Promise<void> {
    await waitForPageReady(this.page);
  }

  /** The current URL, for specs that assert on navigation. */
  public url(): string {
    return this.page.url();
  }

  /** The page title, for specs that assert on it. */
  public async title(): Promise<string> {
    return this.page.title();
  }

  /**
   * Resolves a per-site selector override if one is configured, otherwise the
   * default (spec §4). Use for narrow attribute-level differences only; if a
   * page genuinely diverges, subclass it instead of widening this.
   *
   * @param key             logical override key, e.g. 'pdp.addToCart'
   * @param defaultSelector selector used when no override exists
   */
  protected selectorFor(key: string, defaultSelector: string): string {
    return this.site.overrides?.[key] ?? defaultSelector;
  }
}
