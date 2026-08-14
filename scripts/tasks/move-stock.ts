/**
 * Standalone ERP process task: move stock between locations (spec §9.10).
 *
 *   npm run task:move-stock -- \
 *     --material 123456 --quantity 1 \
 *     --from-plant 1000 --from-location 0001 \
 *     --to-plant 2000 --to-location 0001 \
 *     --movement-type 311
 *
 * A pure process task — testers run this to set up stock conditions for other
 * testing, not to assert anything.
 */
import { chromium } from '@playwright/test';
import { getErpConfig } from '../../config/environments.js';
import { moveStock } from '../../src/flows/erp/moveStock.js';
import { parseArgs, requireArg, runTask } from './taskRunner.js';

await runTask('move-stock', async () => {
  const args = parseArgs(process.argv.slice(2));

  const transfer = {
    material: requireArg(args, 'material', 'SAP material number'),
    quantity: requireArg(args, 'quantity', 'quantity to move'),
    fromPlant: requireArg(args, 'from-plant', 'issuing plant'),
    fromStorageLocation: requireArg(args, 'from-location', 'issuing storage location'),
    toPlant: requireArg(args, 'to-plant', 'receiving plant'),
    toStorageLocation: requireArg(args, 'to-location', 'receiving storage location'),
    movementType: requireArg(args, 'movement-type', 'SAP movement type, e.g. 311'),
  };

  const erpConfig = getErpConfig();

  const browser = await chromium.launch({ headless: process.env['HEADED'] !== '1' });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    const result = await moveStock({
      page,
      erpConfig,
      transfer,
      invokedBy: 'task:move-stock',
      manageSession: true,
    });

    console.warn(
      `\n  Material document : ${result.materialDocument ?? '(none reported)'}\n` +
        `  SAP says          : [${result.statusMessage.type}] ${result.statusMessage.text}\n`
    );

    if (result.statusMessage.type === 'E' || result.statusMessage.type === 'A') {
      throw new Error(`SAP reported an error: ${result.statusMessage.text}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
});
