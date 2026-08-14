/**
 * Stock transfer between locations (MB1B) and stock verification (MMBE).
 */
import type { Page } from '@playwright/test';
import { sapInputByTitle } from '../../utils/sapLocators.js';
import { ErpBasePage } from './ErpBasePage.js';
import type { ErpLoginPage } from './ErpLoginPage.js';
import { TCODE } from './transactionCodes.js';

/** A stock transfer between two plants / storage locations. */
export interface StockTransfer {
  material: string;
  quantity: string;
  /** Issuing plant. */
  fromPlant: string;
  fromStorageLocation: string;
  /** Receiving plant. */
  toPlant: string;
  toStorageLocation: string;
  /** Movement type, e.g. '311' for a same-plant transfer. TODO: confirm WOSG's. */
  movementType: string;
}

export class StockMovementPage extends ErpBasePage {
  constructor(page: Page, _session: ErpLoginPage) {
    super(page);
  }

  /** Opens the transfer-posting transaction. */
  public async open(): Promise<void> {
    await this.runTransaction(TCODE.transferPosting);
  }

  /**
   * Fills the initial transfer-posting screen.
   *
   * @param transfer the movement to post
   */
  public async enterTransferHeader(transfer: StockTransfer): Promise<void> {
    const frame = await this.contentFrame();

    // TODO: confirm field titles on the WOSG system — these are standard MB1B labels.
    await sapInputByTitle(frame, 'Movement Type').fill(transfer.movementType);
    await sapInputByTitle(frame, 'Plant').fill(transfer.fromPlant);
    await sapInputByTitle(frame, 'Storage Location').fill(transfer.fromStorageLocation);

    await sapInputByTitle(frame, 'Storage Location').press('Enter');
    await this.waitForRoundTrip();
    await this.assertNoErrorMessage('entering transfer posting header');
  }

  /**
   * Posts the stock movement.
   *
   * This physically moves stock in the ERP's view, which is why the ERP project
   * is QA-only and guarded (§5, §9.1).
   */
  public async postTransfer(): Promise<void> {
    await this.save();
    await this.dismissPopupIfPresent();
    await this.assertNoErrorMessage('posting the stock transfer');
  }

  /**
   * The material document number created by the posting, read from the status bar.
   */
  public async getMaterialDocumentNumber(): Promise<string | null> {
    const message = await this.getStatusMessage();
    const match = /(\d{6,})/.exec(message.text);
    return match?.[1] ?? null;
  }

  /**
   * Reads the unrestricted stock for a material at a plant, via MMBE.
   *
   * Used to verify a movement actually landed rather than trusting the success
   * message alone.
   *
   * TODO: confirm the MMBE output structure. It is an expandable tree whose
   * layout depends on configuration, so the read is left unimplemented rather
   * than guessed — a wrong locator here would silently return the wrong number,
   * which is worse than failing.
   */
  public async getUnrestrictedStock(_material: string, _plant: string): Promise<number> {
    throw new Error(
      'StockMovementPage.getUnrestrictedStock is not implemented: the MMBE output tree has not ' +
        'been inspected on the WOSG QA system. Confirm the layout before implementing (spec §9.9).'
    );
  }

  /** Opens the stock overview transaction for verification. */
  public async openStockOverview(): Promise<void> {
    await this.runTransaction(TCODE.stockOverview);
  }
}
