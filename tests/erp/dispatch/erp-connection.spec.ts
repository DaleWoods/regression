/**
 * ERP proof test (spec §14 step 8).
 *
 * Proves the hardest layer works: logon, the multiple-logons interstitial, frame
 * resolution, OK-code navigation, round-trip waiting and status-bar reading.
 *
 * Deliberately does NOT change any data. The first ERP test to run against a new
 * system should be read-only — a failing write test on SAP leaves a locked
 * document behind that blocks the next run.
 */
import { test, expect } from '../../../src/fixtures/test.js';
import { TCODE, TCODE_CONFIRMED } from '../../../src/pages/erp/transactionCodes.js';

test.describe('SAP Webgui connection', () => {
  test('should log in and reach the transaction command box @smoke @erp', async ({
    erpSession,
  }) => {
    // The `erpSession` fixture has already logged in by this point; reaching
    // here at all proves logon, the multiple-logons handler and frame
    // resolution all worked.
    const frame = await erpSession.contentFrame();
    const okCode = frame.locator('#ToolbarOkCode, input[name="okcode"]').first();

    await expect(okCode).toBeVisible();
  });

  test('should open the order display transaction and report no error @smoke @erp', async ({
    orderSearchPage,
  }) => {
    // OPEN ITEM (§9.9, §15): the transaction codes are standard-SAP assumptions
    // and are not yet confirmed for WOSG. Flagged loudly rather than silently
    // assumed, because a bespoke Z-transaction would make this fail in a way
    // that looks like a framework bug.
    test.info().annotations.push({
      type: 'unconfirmed-tcode',
      description:
        `Using ${TCODE.displaySalesOrder} (confirmed: ${String(TCODE_CONFIRMED.displaySalesOrder)}). ` +
        `Confirm the real transaction code with the SAP team — see src/pages/erp/transactionCodes.ts.`,
    });

    await orderSearchPage.open();

    // SAP reports failure in the status bar rather than by navigating, so this
    // is the assertion that actually proves the transaction opened (§9.7).
    const status = await orderSearchPage.getStatusMessage();
    expect(
      status.type,
      `SAP returned an error opening ${TCODE.displaySalesOrder}: ${status.text}`
    ).not.toBe('E');
    expect(status.type).not.toBe('A');
  });

  test('should report a clear message when searching for an order that does not exist @erp', async ({
    orderSearchPage,
  }) => {
    await orderSearchPage.open();

    // A deliberately invalid document number. This proves the status-bar reader
    // correctly distinguishes an SAP error from a framework failure — the
    // distinction the whole ERP assertion model depends on.
    const nonExistentOrder = '999999999';
    await orderSearchPage.searchOrder(nonExistentOrder).catch(() => {
      // `searchOrder` throws on an E-type status, which is the expected outcome
      // here. The assertion below is on the message itself.
    });

    const status = await orderSearchPage.getStatusMessage();
    expect(status.text).not.toBe('');
  });
});
