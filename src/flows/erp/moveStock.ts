/**
 * ERP process flow: move stock between locations (spec §9.10).
 *
 * Primarily a PROCESS TASK rather than a test — testers run this to set up stock
 * conditions for other testing. Exposed both to specs and to the CLI
 * (`npm run task:move-stock`).
 *
 * Revisit later (§9.11): a BAPI/OData endpoint would do this far more reliably
 * than the UI, even if the dispatch *tests* stay on the UI.
 */
import type { Page } from '@playwright/test';
import type { ErpConfig } from '../../../config/types.js';
import { ErpLoginPage } from '../../pages/erp/ErpLoginPage.js';
import { StockMovementPage, type StockTransfer } from '../../pages/erp/StockMovementPage.js';
import type { SapStatusMessage } from '../../pages/erp/ErpBasePage.js';
import { recordCreatedErpDocument } from '../../utils/runArtifacts.js';
import { logger } from '../../utils/logger.js';

const log = logger('flow:moveStock');

export interface MoveStockOptions {
  page: Page;
  erpConfig: ErpConfig;
  transfer: StockTransfer;
  invokedBy: string;
  /** True when the flow owns the session (CLI use); false inside a spec. */
  manageSession?: boolean;
}

export interface MoveStockResult {
  materialDocument: string | null;
  statusMessage: SapStatusMessage;
}

/** Posts a transfer posting between two storage locations. */
export async function moveStock(options: MoveStockOptions): Promise<MoveStockResult> {
  const { page, erpConfig, transfer, invokedBy, manageSession = false } = options;

  const session = new ErpLoginPage(page, erpConfig);
  if (manageSession) {
    await session.login();
  }

  try {
    const stockPage = new StockMovementPage(page, session);
    await stockPage.open();
    await stockPage.enterTransferHeader(transfer);
    await stockPage.postTransfer();

    const materialDocument = await stockPage.getMaterialDocumentNumber();
    const statusMessage = await stockPage.getStatusMessage();

    log.info(
      `Moved ${transfer.quantity} x ${transfer.material} ` +
        `${transfer.fromPlant}/${transfer.fromStorageLocation} → ` +
        `${transfer.toPlant}/${transfer.toStorageLocation}: ` +
        `[${statusMessage.type}] ${statusMessage.text}`
    );

    if (materialDocument !== null) {
      recordCreatedErpDocument(
        materialDocument,
        invokedBy,
        `stock transfer ${transfer.material} x${transfer.quantity}`
      );
    }

    return { materialDocument, statusMessage };
  } finally {
    if (manageSession) {
      await session.logout();
    }
  }
}
