/**
 * Hard production guard (spec §5, §9.1).
 *
 * The framework must REFUSE TO RUN if any resolved storefront base URL or ERP
 * host looks like production. This is not a warning and not a skip — it throws,
 * because the failure mode it prevents is placing real orders or dispatching
 * real stock in a live ERP.
 *
 * Design notes:
 *  - The check is deny-by-default in spirit: rather than trying to enumerate
 *    every safe host, it blocks anything that looks live AND requires a
 *    recognised non-production marker to be present.
 *  - It runs in global setup, before a single browser is launched, and again
 *    whenever a site config is resolved — cheap, and catches a URL injected
 *    later by an override.
 */

/**
 * Hostname fragments that identify a PRODUCTION system. Matching any of these
 * (as a whole host or a host without a non-prod marker) is fatal.
 *
 * Extend this list whenever a new live hostname is discovered — an entry here
 * is far cheaper than a live order.
 */
const PRODUCTION_HOST_PATTERNS: readonly RegExp[] = [
  // Live UK storefronts.
  /^(www\.)?goldsmiths\.co\.uk$/i,
  /^(www\.)?mappinandwebb\.com$/i,
  /^(www\.)?watches-of-switzerland\.co\.uk$/i,
  /^(www\.)?thewatchgallery\.com$/i,
  // Live US / group storefronts that are out of scope but must never be hit.
  /^(www\.)?mayors\.com$/i,
  /^(www\.)?betteridge\.com$/i,
  // Live SAP / ERP hosts. `sapprd`, `sapp01`, `erp-prod`, etc.
  /^sapprd/i,
  /^sap-?prod/i,
  /^erp-?prod/i,
  /^prd-/i,
];

/**
 * Substrings that positively identify a NON-production host. A host must
 * contain at least one of these to be considered safe.
 *
 * `uat` and `staging` are the phase-1 targets; the others are included so that
 * standing up a new lower environment does not require a code change.
 */
const NON_PRODUCTION_MARKERS: readonly string[] = [
  'uat',
  'staging',
  'stage',
  'qa',
  'test',
  'dev',
  'sandbox',
  'preprod',
  'pre-prod',
  'localhost',
  '127.0.0.1',
];

/** Thrown when a production target is detected. Deliberately not catchable-by-accident. */
export class ProductionTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionTargetError';
  }
}

function hostnameOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    throw new ProductionTargetError(
      `Cannot parse "${rawUrl}" as a URL, so it cannot be checked against the ` +
        `production blocklist. Refusing to run.`
    );
  }
}

/**
 * Asserts a single URL is not production.
 *
 * @param rawUrl   the fully resolved URL to check
 * @param label    what this URL is, used in the error (e.g. "Goldsmiths base URL")
 * @throws ProductionTargetError when the host is blocklisted or lacks a non-prod marker
 */
export function assertNotProduction(rawUrl: string, label: string): void {
  const hostname = hostnameOf(rawUrl);
  const lowerHost = hostname.toLowerCase();

  // 1. Explicit blocklist — always fatal.
  const blocked = PRODUCTION_HOST_PATTERNS.find((pattern) => pattern.test(lowerHost));
  if (blocked) {
    throw new ProductionTargetError(
      [
        '',
        '  ┌────────────────────────────────────────────────────────────────┐',
        '  │  REFUSING TO RUN — PRODUCTION TARGET DETECTED                  │',
        '  └────────────────────────────────────────────────────────────────┘',
        '',
        `  ${label} resolved to: ${rawUrl}`,
        `  Host "${hostname}" matches the production blocklist (${String(blocked)}).`,
        '',
        '  This framework is permitted to run against UAT/QA only (spec §5).',
        '  Automated checkout and ERP transactions against a live system would',
        '  place real orders and move real stock.',
        '',
        '  Fix the corresponding *_BASE_URL_* / ERP_BASE_URL value in your .env',
        '  (or the GitHub Secret in CI) and run again.',
        '',
      ].join('\n')
    );
  }

  // 2. Positive marker requirement — a lower environment must announce itself.
  const hasMarker = NON_PRODUCTION_MARKERS.some((marker) => lowerHost.includes(marker));
  if (!hasMarker) {
    throw new ProductionTargetError(
      [
        '',
        '  ┌────────────────────────────────────────────────────────────────┐',
        '  │  REFUSING TO RUN — TARGET NOT RECOGNISED AS NON-PRODUCTION     │',
        '  └────────────────────────────────────────────────────────────────┘',
        '',
        `  ${label} resolved to: ${rawUrl}`,
        `  Host "${hostname}" contains none of the expected non-production`,
        `  markers: ${NON_PRODUCTION_MARKERS.join(', ')}.`,
        '',
        '  The guard fails closed: if it cannot prove a host is a lower',
        '  environment, it will not run against it (spec §5).',
        '',
        '  If this host really is a legitimate test environment, add its marker',
        '  to NON_PRODUCTION_MARKERS in config/productionGuard.ts — as a',
        '  reviewed change, not a local edit.',
        '',
      ].join('\n')
    );
  }
}

/**
 * Asserts every supplied target is non-production, reporting them together.
 * Used by global setup so one run surfaces every misconfigured URL at once.
 */
export function assertAllNotProduction(targets: readonly { url: string; label: string }[]): void {
  const failures: string[] = [];

  for (const { url, label } of targets) {
    try {
      assertNotProduction(url, label);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (failures.length > 0) {
    throw new ProductionTargetError(failures.join('\n'));
  }
}
