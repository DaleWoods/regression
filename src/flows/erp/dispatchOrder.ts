/**
 * ERP process flow: dispatch an order (spec §9.10).
 *
 * Dual purpose by design. This is callable:
 *   - from a spec, as the action under test or as setup, and
 *   - from a standalone CLI script (`npm run task:dispatch-order`), so a tester
 *     can force an order into a dispatched state without writing a test.
 *
 * Assertion-free: the caller decides what constitutes success.
 */
import type { Page } from '@playwright/test';
import type { ErpConfig } from '../../../config/types.js';
import { DispatchPage } from '../../pages/erp/DispatchPage.js';
import { ErpLoginPage } from '../../pages/erp/ErpLoginPage.js';
import type { SapStatusMessage } from '../../pages/erp/ErpBasePage.js';
import { recordCreatedErpDocument } from '../../utils/runArtifacts.js';
import { logger } from '../../utils/logger.js';

const log = logger('flow:dispatchOrder');

export interface DispatchOrderOptions {
  page: Page;
  erpConfig: ErpConfig;
  /** SAP outbound delivery number to dispatch. */
  deliveryNumber: string;
  /** Recorded against the created document for traceability. */
  invokedBy: string;
  /**
   * When true the flow logs in and out itself. Specs pass false because the
   * `erpSession` fixture already owns the session.
   */
  manageSession?: boolean;
}

export interface DispatchResult {
  deliveryNumber: string;
  /** The status bar message SAP returned after posting goods issue. */
  statusMessage: SapStatusMessage;
}

/**
 * Posts goods issue against an outbound delivery.
 *
 * @returns the delivery number and SAP's status message — the caller asserts on
 *          the message type (§9.7), since SAP reports outcome there rather than
 *          by navigating.
 */
export async function dispatchOrder(options: DispatchOrderOptions): Promise<DispatchResult> {
  const { page, erpConfig, deliveryNumber, invokedBy, manageSession = false } = options;

  const session = new ErpLoginPage(page, erpConfig);
  if (manageSession) {
    await session.login();
  }

  try {
    const dispatchPage = new DispatchPage(page, session);
    await dispatchPage.open();
    await dispatchPage.openDelivery(deliveryNumber);
    await dispatchPage.postGoodsIssue();

    const statusMessage = await dispatchPage.getStatusMessage();
    log.info(
      `Dispatched delivery ${deliveryNumber}: [${statusMessage.type}] ${statusMessage.text}`
    );

    recordCreatedErpDocument(deliveryNumber, invokedBy, 'goods issue posted');

    return { deliveryNumber, statusMessage };
  } finally {
    if (manageSession) {
      await session.logout();
    }
  }
}
