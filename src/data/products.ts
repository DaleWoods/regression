/**
 * Fixed, pre-seeded product references (spec §8).
 *
 * ⚠️ ALL SKUs BELOW ARE PLACEHOLDERS — OPEN ITEM (§15).
 * Confirm the real UAT SKUs per site before any test depends on them. The
 * `@data-check` smoke test validates every entry and fails with a clear
 * data-integrity message, so a stale SKU surfaces as "this product is gone",
 * not as a confusing assertion failure three steps into checkout.
 *
 * Products are keyed by CHARACTERISTIC rather than by SKU, so a test says
 * "give me an in-stock simple product for this site" and stays correct when the
 * underlying SKU is swapped.
 */
import type { SiteKey } from '../../config/types.js';

/** What a test needs a product FOR, rather than which product it is. */
export type ProductCharacteristic =
  | 'inStockSimple'
  | 'inStockVariant'
  | 'outOfStock'
  | 'highValue'
  | 'financeEligible'
  | 'clickAndCollectEligible';

export interface ProductReference {
  /** SAP product code / SKU. */
  sku: string;
  /** Expected product name, asserted by the @data-check test. */
  expectedName: string;
  /** URL path to the PDP, relative to the site base URL. */
  path: string;
  /** Which sites this product exists on. */
  sites: readonly SiteKey[];
  /** True once the SKU has been confirmed against UAT. */
  confirmed: boolean;
}

/**
 * The curated product set, per characteristic, per site.
 *
 * TODO: replace every placeholder below with a confirmed UAT SKU and set
 * `confirmed: true`. Until then the @data-check test reports them as unconfirmed.
 */
const CATALOGUE: Record<SiteKey, Partial<Record<ProductCharacteristic, ProductReference>>> = {
  goldsmiths: {
    inStockSimple: {
      sku: 'TODO-GS-SIMPLE',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-GS-SIMPLE',
      sites: ['goldsmiths'],
      confirmed: false,
    },
    inStockVariant: {
      sku: 'TODO-GS-VARIANT',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-GS-VARIANT',
      sites: ['goldsmiths'],
      confirmed: false,
    },
    outOfStock: {
      sku: 'TODO-GS-OOS',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-GS-OOS',
      sites: ['goldsmiths'],
      confirmed: false,
    },
    highValue: {
      sku: 'TODO-GS-HIGHVALUE',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-GS-HIGHVALUE',
      sites: ['goldsmiths'],
      confirmed: false,
    },
    financeEligible: {
      sku: 'TODO-GS-FINANCE',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-GS-FINANCE',
      sites: ['goldsmiths'],
      confirmed: false,
    },
    clickAndCollectEligible: {
      sku: 'TODO-GS-CC',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-GS-CC',
      sites: ['goldsmiths'],
      confirmed: false,
    },
  },

  'mappin-webb': {
    inStockSimple: {
      sku: 'TODO-MW-SIMPLE',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-MW-SIMPLE',
      sites: ['mappin-webb'],
      confirmed: false,
    },
    inStockVariant: {
      sku: 'TODO-MW-VARIANT',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-MW-VARIANT',
      sites: ['mappin-webb'],
      confirmed: false,
    },
    outOfStock: {
      sku: 'TODO-MW-OOS',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-MW-OOS',
      sites: ['mappin-webb'],
      confirmed: false,
    },
    highValue: {
      sku: 'TODO-MW-HIGHVALUE',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-MW-HIGHVALUE',
      sites: ['mappin-webb'],
      confirmed: false,
    },
    financeEligible: {
      sku: 'TODO-MW-FINANCE',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-MW-FINANCE',
      sites: ['mappin-webb'],
      confirmed: false,
    },
    clickAndCollectEligible: {
      sku: 'TODO-MW-CC',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-MW-CC',
      sites: ['mappin-webb'],
      confirmed: false,
    },
  },

  wos: {
    inStockSimple: {
      sku: 'TODO-WOS-SIMPLE',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-WOS-SIMPLE',
      sites: ['wos'],
      confirmed: false,
    },
    inStockVariant: {
      sku: 'TODO-WOS-VARIANT',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-WOS-VARIANT',
      sites: ['wos'],
      confirmed: false,
    },
    outOfStock: {
      sku: 'TODO-WOS-OOS',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-WOS-OOS',
      sites: ['wos'],
      confirmed: false,
    },
    highValue: {
      sku: 'TODO-WOS-HIGHVALUE',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-WOS-HIGHVALUE',
      sites: ['wos'],
      confirmed: false,
    },
    financeEligible: {
      sku: 'TODO-WOS-FINANCE',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-WOS-FINANCE',
      sites: ['wos'],
      confirmed: false,
    },
    clickAndCollectEligible: {
      sku: 'TODO-WOS-CC',
      expectedName: 'TODO: confirm expected product name',
      path: '/p/TODO-WOS-CC',
      sites: ['wos'],
      confirmed: false,
    },
  },
};

/**
 * Returns the fixed product for a characteristic on a site.
 *
 * @throws with a data-integrity message when no product is curated for that
 *         combination — deliberately loud, so a missing fixture never presents
 *         as a mysterious navigation failure (§8).
 */
export function getProduct(site: SiteKey, characteristic: ProductCharacteristic): ProductReference {
  const product = CATALOGUE[site][characteristic];

  if (!product) {
    throw new Error(
      `DATA INTEGRITY: no "${characteristic}" product is curated for site "${site}".\n` +
        `  Add one to src/data/products.ts, or skip this test for this site using a feature flag.`
    );
  }

  return product;
}

/** Every curated product for a site — used by the @data-check test. */
export function getAllProductsForSite(site: SiteKey): ProductReference[] {
  return Object.values(CATALOGUE[site]);
}

/** Whether a product reference is still a placeholder. */
export function isPlaceholder(product: ProductReference): boolean {
  return !product.confirmed || product.sku.startsWith('TODO-');
}
