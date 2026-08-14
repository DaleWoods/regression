/**
 * Shared configuration types for the WOSG UK framework.
 *
 * Kept in one place so `config/`, `src/fixtures/` and page objects all agree on
 * the shape of a site without importing each other's concrete modules.
 */

/** Stable machine keys for the three phase-1 storefronts (spec §4). */
export type SiteKey = 'goldsmiths' | 'mappin-webb' | 'wos';

/** Environments the framework knows about. Phase 1 targets `uat` only, but the
 *  other slots exist so a new environment is config, not a refactor (spec §5). */
export type EnvironmentName = 'dev' | 'staging' | 'uat';

/**
 * Per-site feature flags.
 *
 * Site differences are expressed here and guarded with `test.skip()` in specs —
 * never with `if (site === ...)` branching inside a page method (spec §4).
 * Extend this interface as real differences are discovered; adding a key forces
 * every site config to declare a value, which is deliberate.
 */
export interface SiteFeatures {
  /** Click & Collect available as a delivery mode at checkout. */
  clickAndCollect: boolean;
  /** V12 Retail Finance offered on eligible products. */
  financeV12: boolean;
  /** PayPal Credit offered as a payment method. */
  payPalCredit: boolean;
  /** Wishlist / "Saved items" available to logged-in customers. */
  wishlist: boolean;
  /** Guest checkout permitted (vs. forced account creation). */
  guestCheckout: boolean;
  /** Book-an-appointment CTA present on PDP. */
  appointmentBooking: boolean;
}

/**
 * A single storefront's configuration. One of these is injected into every test
 * via the `site` fixture, so a test written once runs against all three sites.
 */
export interface SiteConfig {
  key: SiteKey;
  /** Human-readable name used in report titles and log lines. */
  displayName: string;
  /** Resolved from env vars at load time — never hard-coded (spec §3, §5). */
  baseUrl: string;
  currency: 'GBP';
  locale: 'en-GB';
  features: SiteFeatures;
  /**
   * Rare per-site selector overrides, keyed by a logical name the page object
   * looks up (e.g. `'pdp.addToCart'`). Prefer subclassing the page object when a
   * page genuinely diverges; this hatch is for one-off attribute differences
   * only (spec §4).
   */
  overrides?: Partial<Record<string, string>>;
}

/** Resolved ERP (SAP Webgui) connection details — QA instance only (spec §9). */
export interface ErpConfig {
  baseUrl: string;
  client: string;
  user: string;
  password: string;
  language: string;
}

/** A fully resolved environment: every site plus the ERP target. */
export interface EnvironmentConfig {
  name: EnvironmentName;
  sites: Record<SiteKey, SiteConfig>;
  erp: ErpConfig;
}
