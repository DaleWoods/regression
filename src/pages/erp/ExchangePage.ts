/**
 * Returns / exchange order creation (VA01 with a returns order type).
 */
import type { Page } from '@playwright/test';
import { sapInputByTitle } from '../../utils/sapLocators.js';
import { ErpBasePage } from './ErpBasePage.js';
import type { ErpLoginPage } from './ErpLoginPage.js';
import { TCODE } from './transactionCodes.js';

/** Header fields required to create a returns order. */
export interface ReturnsOrderHeader {
  /** Sales document type for returns, e.g. 'RE'. TODO: confirm WOSG's type. */
  orderType: string;
  salesOrganisation: string;
  distributionChannel: string;
  division: string;
  /** The original sales order being returned against. */
  referenceOrder: string;
}

export class ExchangePage extends ErpBasePage {
  constructor(page: Page, _session: ErpLoginPage) {
    super(page);
  }

  /** Opens the create-sales-order transaction. */
  public async open(): Promise<void> {
    await this.runTransaction(TCODE.createSalesOrder);
  }

  /**
   * Fills the initial screen that selects the order type and sales area.
   *
   * @param header returns order header values
   */
  public async enterOrderHeader(header: ReturnsOrderHeader): Promise<void> {
    const frame = await this.contentFrame();

    // TODO: confirm all four field titles. These are the standard VA01 initial
    // screen labels; a bespoke variant will differ.
    await sapInputByTitle(frame, 'Order Type').fill(header.orderType);
    await sapInputByTitle(frame, 'Sales Organization').fill(header.salesOrganisation);
    await sapInputByTitle(frame, 'Distribution Channel').fill(header.distributionChannel);
    await sapInputByTitle(frame, 'Division').fill(header.division);

    await sapInputByTitle(frame, 'Division').press('Enter');
    await this.waitForRoundTrip();
    await this.assertNoErrorMessage('entering returns order header');
  }

  /**
   * Creates the return with reference to an existing sales order.
   *
   * TODO: confirm the create-with-reference flow. In standard SAP this is a
   * dialog reached from the initial screen, but the button title and dialog
   * structure must be checked against the WOSG system before this is trusted.
   */
  public async createWithReference(_referenceOrder: string): Promise<void> {
    throw new Error(
      'ExchangePage.createWithReference is not implemented: the create-with-reference dialog ' +
        'has not been inspected on the WOSG QA system. Confirm the flow before implementing (spec §9.9).'
    );
  }

  /**
   * The created returns document number, read from the status bar.
   *
   * SAP reports the new document number in the status bar on save — there is no
   * screen to read it from (§9.7).
   */
  public async getCreatedDocumentNumber(): Promise<string | null> {
    const message = await this.getStatusMessage();
    // e.g. "Standard Order 12345678 has been saved"
    const match = /(\d{6,})/.exec(message.text);
    return match?.[1] ?? null;
  }

  /** Saves the returns order. */
  public async saveOrder(): Promise<void> {
    await this.save();
    await this.dismissPopupIfPresent();
    await this.assertNoErrorMessage('saving the returns order');
  }
}
