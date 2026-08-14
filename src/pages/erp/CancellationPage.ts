/**
 * Sales order change (VA02) — order cancellation and line-item rejection.
 */
import type { Page } from '@playwright/test';
import { sapDropdownByTitle, sapInputByTitle } from '../../utils/sapLocators.js';
import { ErpBasePage } from './ErpBasePage.js';
import type { ErpLoginPage } from './ErpLoginPage.js';
import { TCODE } from './transactionCodes.js';

export class CancellationPage extends ErpBasePage {
  constructor(page: Page, _session: ErpLoginPage) {
    super(page);
  }

  /** Opens the change-sales-order transaction. */
  public async open(): Promise<void> {
    await this.runTransaction(TCODE.changeSalesOrder);
  }

  /**
   * Opens a sales order for change.
   *
   * @param orderNumber SAP sales document number
   */
  public async openOrder(orderNumber: string): Promise<void> {
    const frame = await this.contentFrame();
    const orderField = sapInputByTitle(frame, 'Order');
    await orderField.waitFor({ state: 'visible', timeout: 30_000 });
    await orderField.fill(orderNumber);
    await orderField.press('Enter');

    await this.waitForRoundTrip();
    await this.dismissPopupIfPresent();
    await this.assertNoErrorMessage(`opening order ${orderNumber} for change`);
  }

  /**
   * Sets a rejection reason on a line item, which is how SAP cancels a line.
   *
   * @param lineIndex       zero-based row index in the item table control
   * @param reasonForRejection rejection reason key or its display text
   */
  public async rejectLineItem(lineIndex: number, reasonForRejection: string): Promise<void> {
    const frame = await this.contentFrame();
    // TODO: confirm the column title. 'Reason for rejection' is the standard
    // VA02 item-table column, but the item overview layout is configurable.
    const reasonCell = sapDropdownByTitle(frame, 'Reason for rejection').nth(lineIndex);
    await reasonCell.selectOption({ label: reasonForRejection }).catch(async () => {
      // Some configurations render this as a plain input rather than a dropdown.
      const asInput = frame.locator('[ct="I"][title*="Reason for rejection"]').nth(lineIndex);
      await asInput.fill(reasonForRejection);
      await asInput.press('Enter');
    });

    await this.waitForRoundTrip();
    await this.assertNoErrorMessage(`rejecting line item ${lineIndex}`);
  }

  /**
   * Cancels the whole order by rejecting every line.
   *
   * TODO: confirm whether WOSG cancels via mass rejection or a bespoke Z
   * transaction — this is one of the open items in §9.9 and materially changes
   * the implementation.
   */
  public async cancelEntireOrder(_reasonForRejection: string): Promise<void> {
    throw new Error(
      'CancellationPage.cancelEntireOrder is not implemented: confirm with the SAP team whether ' +
        'WOSG cancels an order by mass line rejection in VA02 or via a bespoke Z transaction (spec §9.9).'
    );
  }

  /** Saves the order, committing the rejection. */
  public async saveOrder(): Promise<void> {
    await this.save();
    await this.dismissPopupIfPresent();
    await this.assertNoErrorMessage('saving the cancelled order');
  }
}
