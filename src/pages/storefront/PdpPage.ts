/**
 * Product detail page — product media, price, variants and add-to-bag.
 */
import type { Locator, Page } from '@playwright/test';
import type { SiteConfig } from '../../../config/types.js';
import { Header } from '../../components/Header.js';
import { MiniCart } from '../../components/MiniCart.js';
import { PDP as PDP_SELECTORS } from '../../utils/selectors.js';
import { BasePage } from '../BasePage.js';

export class PdpPage extends BasePage {
  public readonly header: Header;
  public readonly miniCart: MiniCart;

  private readonly productTitle: Locator;
  private readonly price: Locator;
  private readonly addToBagButton: Locator;
  private readonly outOfStockMessage: Locator;

  constructor(page: Page, site: SiteConfig) {
    super(page, site);
    this.header = new Header(page);
    this.miniCart = new MiniCart(page);

    // The product name is the page's h1 on all three sites.
    this.productTitle = page.getByRole('heading', { level: 1 }).first();

    // [VERIFIED] Spartacus add-to-cart form + button, confirmed in the previous
    // suite against Goldsmiths UAT. `selectorFor` allows a per-site override
    // without branching logic inside this method (spec §4).
    this.addToBagButton = page.locator(
      this.selectorFor('pdp.addToCart', PDP_SELECTORS.addToCartButton)
    );

    // Price: scoped to the main region so it cannot match a "from £x" figure in
    // a recommendations rail.
    // TODO: confirm a dedicated price hook (ideally a data-testid — raise with
    // dev). Matching a £ amount in main is correct but broader than ideal.
    this.price = page
      .getByRole('main')
      .getByText(/£\s?[\d,]+(\.\d{2})?/)
      .first();

    // TODO: confirm out-of-stock messaging copy per site.
    this.outOfStockMessage = page.getByText(/out of stock|sold out|unavailable/i).first();
  }

  protected get path(): string | null {
    // PDPs are reached by SKU-specific URL via `gotoProduct`, never a fixed path.
    return null;
  }

  /**
   * Navigates directly to a product by its URL path.
   *
   * @param productPath path containing the `/p/` segment, e.g. '/p/1234567'
   */
  public async gotoProduct(productPath: string): Promise<void> {
    await this.goto(productPath);
  }

  /** The product name shown as the page heading. */
  public async getProductName(): Promise<string> {
    return (await this.productTitle.innerText()).trim();
  }

  /** The displayed price as shown, e.g. "£1,250.00". */
  public async getPrice(): Promise<string> {
    return (await this.price.innerText()).trim();
  }

  /**
   * The displayed price parsed to a number, for range and threshold assertions.
   * Returns NaN when the text does not contain a parseable amount, which the
   * calling spec should assert against rather than silently tolerate.
   */
  public async getPriceValue(): Promise<number> {
    const raw = await this.getPrice();
    const digits = raw.replace(/[^\d.]/g, '');
    return Number.parseFloat(digits);
  }

  /** Whether a price is displayed at all. */
  public async hasPrice(): Promise<boolean> {
    return this.price.isVisible();
  }

  /** Whether the product is purchasable (add-to-bag enabled, no OOS message). */
  public async isInStock(): Promise<boolean> {
    if (await this.outOfStockMessage.isVisible()) return false;
    return this.addToBagButton.isEnabled();
  }

  /** Selects a size or variant by its visible label. */
  public async selectSize(size: string): Promise<void> {
    // TODO: confirm the variant selector control. Spartacus renders these as
    // either a select or a button group depending on the variant type — this
    // must be checked against a real variant product before use.
    await this.page.getByRole('button', { name: size, exact: true }).click();
  }

  /**
   * Adds the product to the bag and waits for the mini-cart drawer to open.
   *
   * The drawer opening is the observable completion signal for the add — the
   * button itself re-renders in place, so waiting on it proves nothing.
   */
  public async addToBag(): Promise<void> {
    await this.addToBagButton.click();
    await this.miniCart.waitUntilOpen();
  }
}
