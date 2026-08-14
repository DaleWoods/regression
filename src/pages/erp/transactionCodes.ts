/**
 * SAP transaction codes used by the ERP page objects (spec §9.9).
 *
 * ⚠️ UNCONFIRMED — OPEN ITEM (§15).
 * These are the STANDARD SAP codes and a starting assumption only. WOSG very
 * likely uses bespoke `Z*` transactions for some of these. Every code below
 * must be confirmed with the SAP team, and the confirmed list added to the
 * README, before the corresponding tests are treated as trustworthy.
 *
 * Centralised here so that swapping VL02N for, say, ZDISPATCH is a one-line
 * change rather than a hunt through page objects.
 */

export const TCODE = {
  /** Display sales order. Used for read-only order verification. */
  displaySalesOrder: 'VA03',
  /** Change sales order — used for cancellation and line rejection. */
  changeSalesOrder: 'VA02',
  /** Create sales order — used for returns/exchange order types. */
  createSalesOrder: 'VA01',
  /** Change outbound delivery — used for dispatch / goods issue. */
  changeOutboundDelivery: 'VL02N',
  /** Collective goods issue processing. */
  collectiveGoodsIssue: 'VL06O',
  /** Transfer posting — stock movement between locations. */
  transferPosting: 'MB1B',
  /** Goods movement (alternative to MB1B, depending on configuration). */
  goodsMovement: 'MIGO',
  /** Stock overview — used to verify stock levels after a movement. */
  stockOverview: 'MMBE',
} as const;

export type TransactionCode = (typeof TCODE)[keyof typeof TCODE];

/**
 * Confirmation status of each code, surfaced in test output so an unconfirmed
 * code cannot quietly become load-bearing.
 */
export const TCODE_CONFIRMED: Record<keyof typeof TCODE, boolean> = {
  displaySalesOrder: false,
  changeSalesOrder: false,
  createSalesOrder: false,
  changeOutboundDelivery: false,
  collectiveGoodsIssue: false,
  transferPosting: false,
  goodsMovement: false,
  stockOverview: false,
};
