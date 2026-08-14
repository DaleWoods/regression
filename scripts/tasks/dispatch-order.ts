/**
 * Standalone ERP process task: dispatch an order (spec §9.10).
 *
 *   npm run task:dispatch-order -- --delivery 80001234
 *
 * Lets a tester force an order into a dispatched state without writing a test.
 * The same flow is called from specs, so behaviour cannot drift between the two.
 */
import { chromium } from '@playwright/test';
import { getErpConfig } from '../../config/environments.js';
import { dispatchOrder } from '../../src/flows/erp/dispatchOrder.js';
import { parseArgs, requireArg, runTask } from './taskRunner.js';

await runTask('dispatch-order', async () => {
  const args = parseArgs(process.argv.slice(2));
  const deliveryNumber = requireArg(args, 'delivery', 'SAP outbound delivery number to dispatch');

  // Resolving config here runs the production guard before a browser opens.
  const erpConfig = getErpConfig();

  const browser = await chromium.launch({ headless: process.env['HEADED'] !== '1' });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    const result = await dispatchOrder({
      page,
      erpConfig,
      deliveryNumber,
      invokedBy: 'task:dispatch-order',
      manageSession: true,
    });

    console.warn(
      `\n  Delivery : ${result.deliveryNumber}\n` +
        `  SAP says : [${result.statusMessage.type}] ${result.statusMessage.text}\n`
    );

    if (result.statusMessage.type === 'E' || result.statusMessage.type === 'A') {
      throw new Error(`SAP reported an error: ${result.statusMessage.text}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
});
