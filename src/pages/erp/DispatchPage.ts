/**
 * Outbound delivery / goods issue (VL02N) — dispatches an order.
 */
import type { Page } from '@playwright/test';
import { sapButtonByTitle, sapInputByTitle } from '../../utils/sapLocators.js';
import { ErpBasePage } from './ErpBasePage.js';
import type { ErpLoginPage } from './ErpLoginPage.js';
import { TCODE } from './transactionCodes.js';

export class DispatchPage extends ErpBasePage {
  constructor(page: Page, _session: ErpLoginPage) {
    super(page);
  }

  /** Opens the change-outbound-delivery transaction. */
  public async open(): Promise<void> {
    await this.runTransaction(TCODE.changeOutboundDelivery);
  }

  /**
   * Opens a delivery document for processing.
   *
   * @param deliveryNumber SAP outbound delivery number
   */
  public async openDelivery(deliveryNumber: string): Promise<void> {
    const frame = await this.contentFrame();
    // TODO: confirm the field title — 'Outbound Delivery' is the standard VL02N label.
    const deliveryField = sapInputByTitle(frame, 'Outbound Delivery');
    await deliveryField.waitFor({ state: 'visible', timeout: 30_000 });
    await deliveryField.fill(deliveryNumber);
    await deliveryField.press('Enter');

    await this.waitForRoundTrip();
    await this.dismissPopupIfPresent();
    await this.assertNoErrorMessage(`opening delivery ${deliveryNumber}`);
  }

  /**
   * Posts goods issue, completing the dispatch.
   *
   * This is the state-changing step: after it, stock has left the warehouse in
   * the ERP's view and the order status advances. The status bar message is the
   * only success signal — the screen does not navigate (§9.7).
   */
  public async postGoodsIssue(): Promise<void> {
    const frame = await this.contentFrame();
    // TODO: confirm the button title. 'Post Goods Issue' is standard.
    await sapButtonByTitle(frame, 'Post Goods Issue').click();
    await this.waitForRoundTrip();

    // A save-confirmation dialog appears in some configurations.
    await this.dismissPopupIfPresent();
    await this.assertNoErrorMessage('posting goods issue');
  }

  /**
   * The picked quantity for a delivery line.
   *
   * @param lineIndex zero-based row index within the item table control
   */
  public async getPickedQuantity(lineIndex = 0): Promise<string> {
    const frame = await this.contentFrame();
    // Table controls are virtualised — this reads a VISIBLE row only. For a
    // specific item, filter the table first and use findRowByCellText (§9.8).
    const quantityCell = frame.locator('[ct="I"][title*="Picked"]').nth(lineIndex);
    return (await quantityCell.inputValue().catch(() => '')).trim();
  }

  /**
   * Sets the picking quantity on a delivery line.
   *
   * @param lineIndex zero-based row index
   * @param quantity  quantity to pick
   */
  public async setPickQuantity(lineIndex: number, quantity: string): Promise<void> {
    const frame = await this.contentFrame();
    const cell = frame.locator('[ct="I"][title*="Picked"]').nth(lineIndex);
    await cell.fill(quantity);
    await cell.press('Enter');
    await this.waitForRoundTrip();
  }
}
