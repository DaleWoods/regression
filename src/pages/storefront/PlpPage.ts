/**
 * Product listing page — category and search results grids.
 */
import type { Locator, Page } from '@playwright/test';
import type { SiteConfig } from '../../../config/types.js';
import { Header } from '../../components/Header.js';
import { PLP } from '../../utils/selectors.js';
import { BasePage } from '../BasePage.js';

export class PlpPage extends BasePage {
  public readonly header: Header;

  private readonly productTiles: Locator;
  private readonly resultsHeading: Locator;
  private readonly sortDropdown: Locator;
  private readonly loadMoreButton: Locator;

  constructor(page: Page, site: SiteConfig) {
    super(page, site);
    this.header = new Header(page);

    // [VERIFIED] Tile class hooks confirmed in use against Goldsmiths UAT.
    this.productTiles = page.locator(PLP.tile);
    this.resultsHeading = page.getByRole('heading', { level: 1 }).first();

    // TODO: confirm the sort control. Spartacus renders a native select in some
    // themes and a custom listbox in others — must be checked before use.
    this.sortDropdown = page.getByRole('combobox', { name: /sort/i }).first();
    // TODO: confirm pagination style (load-more vs numbered) per site.
    this.loadMoreButton = page.getByRole('button', { name: /load more|show more/i }).first();
  }

  protected get path(): string | null {
    // PLPs are category-specific; callers pass the path to `goto`.
    return null;
  }

  /** The PLP is ready once at least one product tile has rendered. */
  public override async waitUntilReady(): Promise<void> {
    await super.waitUntilReady();
    await this.productTiles.first().waitFor({ state: 'visible', timeout: 20_000 });
  }

  /** Number of product tiles currently rendered. */
  public async getProductCount(): Promise<number> {
    return this.productTiles.count();
  }

  /** The category or search-results heading. */
  public async getHeading(): Promise<string> {
    return (await this.resultsHeading.innerText()).trim();
  }

  /**
   * Opens the product at `index` (0-based) by following its PDP link.
   *
   * Uses the tile's own anchor rather than clicking the tile body: the tile has
   * hover overlays (quick-view, wishlist) that intercept a centre-point click.
   */
  public async openProduct(index = 0): Promise<void> {
    const link = this.productTiles.nth(index).locator(PLP.pdpLinkInTile).first();
    await link.click();
  }

  /** The href of the product at `index`, for tests that navigate directly. */
  public async getProductHref(index = 0): Promise<string | null> {
    return this.productTiles.nth(index).locator(PLP.pdpLinkInTile).first().getAttribute('href');
  }

  /** Sorts the grid by the given visible option label. */
  public async sortBy(option: string): Promise<void> {
    await this.sortDropdown.selectOption({ label: option });
  }

  /** Loads the next page of results, where the site uses a load-more control. */
  public async loadMore(): Promise<void> {
    await this.loadMoreButton.click();
  }

  /**
   * Applies a facet filter by its visible label.
   *
   * TODO: confirm the facet panel structure. Left unimplemented rather than
   * guessed — a wrong facet locator silently filters nothing and produces a
   * test that passes for the wrong reason.
   */
  public async applyFilter(_facetLabel: string): Promise<void> {
    throw new Error(
      'PlpPage.applyFilter is not implemented: the facet panel DOM has not been confirmed. ' +
        'Inspect the real PLP and implement this before writing filter tests.'
    );
  }
}
