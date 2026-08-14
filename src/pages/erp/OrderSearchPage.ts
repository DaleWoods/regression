/**
 * Sales order search / display screen (VA03) — locates an order and reads its status.
 */
import type { Page } from '@playwright/test';
import { sapButtonByTitle, sapInputByTitle } from '../../utils/sapLocators.js';
import { ErpBasePage } from './ErpBasePage.js';
import type { ErpLoginPage } from './ErpLoginPage.js';
import { TCODE } from './transactionCodes.js';

export class OrderSearchPage extends ErpBasePage {
  constructor(page: Page, _session: ErpLoginPage) {
    // The session fixture guarantees a logged-in Webgui session before this
    // page object is constructed; it is taken as a dependency rather than used
    // directly so the ordering is explicit.
    super(page);
  }

  /** Opens the display-sales-order transaction. */
  public async open(): Promise<void> {
    await this.runTransaction(TCODE.displaySalesOrder);
  }

  /**
   * Searches for a sales order by document number.
   *
   * @param orderNumber SAP sales document number
   */
  public async searchOrder(orderNumber: string): Promise<void> {
    const frame = await this.contentFrame();

    // Located by `title` — the most stable anchor Webgui offers (§9.3).
    // TODO: confirm the exact field title on the WOSG system. 'Order' is the
    // standard VA03 label; a bespoke Z-transaction will differ.
    const orderField = sapInputByTitle(frame, 'Order');
    await orderField.waitFor({ state: 'visible', timeout: 30_000 });
    await orderField.fill(orderNumber);
    await orderField.press('Enter');

    await this.waitForRoundTrip();
    await this.assertNoErrorMessage(`searching for order ${orderNumber}`);
  }

  /**
   * Reads the overall processing status of the displayed order.
   *
   * TODO: confirm where the WOSG configuration surfaces overall status — it is
   * on the Status tab in standard SAP, but the tab layout is configurable.
   */
  public async getOrderStatus(): Promise<string> {
    const frame = await this.contentFrame();
    const statusField = sapInputByTitle(frame, 'Overall status');
    return (await statusField.inputValue().catch(() => '')).trim();
  }

  /** Whether an order with the given number was found. */
  public async orderExists(orderNumber: string): Promise<boolean> {
    const message = await this.getStatusMessage();
    if (/does not exist/i.test(message.text)) return false;

    const frame = await this.contentFrame();
    const orderField = sapInputByTitle(frame, 'Order');
    const value = await orderField.inputValue().catch(() => '');
    // SAP left-pads document numbers with zeros.
    return value.replace(/^0+/, '') === orderNumber.replace(/^0+/, '');
  }

  /** Opens the document flow for the displayed order. */
  public async openDocumentFlow(): Promise<void> {
    const frame = await this.contentFrame();
    await sapButtonByTitle(frame, 'Display document flow').click();
    await this.waitForRoundTrip();
  }
}
