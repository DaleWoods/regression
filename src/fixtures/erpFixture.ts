/**
 * ERP fixtures — SAP GUI for HTML (Webgui) session and page objects (spec §9).
 *
 * SESSION MODEL
 * -------------
 * SAP sessions are stateful server-side (MYSAPSSO2 cookie plus a server
 * session), so `storageState` reuse is unreliable (§9.6). Each ERP worker
 * therefore performs one fresh login and holds that session for the duration of
 * the project, rather than logging in per test.
 *
 * This is safe only because the ERP project runs with `workers: 1` (§9.1) —
 * SAP enforces object locks and a per-user concurrent session limit, so
 * parallel workers on one user produce lock errors that look like test bugs.
 */
import { test as base } from '@playwright/test';
import { getErpConfig } from '../../config/environments.js';
import type { ErpConfig } from '../../config/types.js';
import { ErpLoginPage } from '../pages/erp/ErpLoginPage.js';
import { OrderSearchPage } from '../pages/erp/OrderSearchPage.js';
import { DispatchPage } from '../pages/erp/DispatchPage.js';
import { CancellationPage } from '../pages/erp/CancellationPage.js';
import { ExchangePage } from '../pages/erp/ExchangePage.js';
import { StockMovementPage } from '../pages/erp/StockMovementPage.js';
import { logger } from '../utils/logger.js';

const log = logger('erp-fixture');

export interface ErpFixtures {
  erpConfig: ErpConfig;
  /** A logged-in Webgui session. Depend on this in any ERP page fixture. */
  erpSession: ErpLoginPage;
  orderSearchPage: OrderSearchPage;
  dispatchPage: DispatchPage;
  cancellationPage: CancellationPage;
  exchangePage: ExchangePage;
  stockMovementPage: StockMovementPage;
}

export const erpTest = base.extend<ErpFixtures>({
  // Playwright's fixture signature requires a destructured first argument even
  // when, as here, the fixture depends on no other fixture.
  // eslint-disable-next-line no-empty-pattern
  erpConfig: async ({}, use) => {
    await use(getErpConfig());
  },

  /**
   * Logs in once per worker and logs out in teardown.
   *
   * The explicit logout matters: an abandoned Webgui session is held server-side
   * until it times out, and each one eats into the user's concurrent session
   * limit — so a run that skips teardown makes the *next* run fail (§9.6).
   */
  erpSession: async ({ page, erpConfig }, use) => {
    const loginPage = new ErpLoginPage(page, erpConfig);

    log.info(`Logging in to SAP Webgui as ${erpConfig.user} (client ${erpConfig.client})`);
    await loginPage.login();

    await use(loginPage);

    log.info('Ending SAP session (/nend) and releasing the server-side session');
    await loginPage.logout();
  },

  orderSearchPage: async ({ page, erpSession }, use) => {
    await use(new OrderSearchPage(page, erpSession));
  },

  dispatchPage: async ({ page, erpSession }, use) => {
    await use(new DispatchPage(page, erpSession));
  },

  cancellationPage: async ({ page, erpSession }, use) => {
    await use(new CancellationPage(page, erpSession));
  },

  exchangePage: async ({ page, erpSession }, use) => {
    await use(new ExchangePage(page, erpSession));
  },

  stockMovementPage: async ({ page, erpSession }, use) => {
    await use(new StockMovementPage(page, erpSession));
  },
});
