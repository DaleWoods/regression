/**
 * Shared waiting helpers.
 *
 * Rule (spec §13): there is no `waitForTimeout` in this framework — a lint rule
 * bans it. Everything here waits on an observable condition and fails with a
 * message that says what it was waiting for.
 */
import type { Frame, Locator, Page } from '@playwright/test';

/** Default budget for storefront waits. ERP overrides this — see waitForRoundTrip. */
export const STOREFRONT_SETTLE_TIMEOUT_MS = 15_000;

/**
 * Waits for the page to be usable rather than merely loaded.
 *
 * Spartacus hydrates after `load`, so `networkidle` alone is both slow and
 * unreliable. We wait for the DOM to be ready and then for Angular's initial
 * render marker, falling back to document.readyState when the marker is absent.
 */
export async function waitForPageReady(
  page: Page,
  timeout: number = STOREFRONT_SETTLE_TIMEOUT_MS
): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout });
  await page
    .waitForFunction(() => document.readyState === 'complete', undefined, { timeout })
    .catch(() => {
      // A long-polling third-party script can keep readyState busy. The
      // web-first assertion that follows in the caller is the real gate, so a
      // timeout here is informational rather than fatal.
    });
}

/**
 * Returns the first locator from `candidates` that resolves to a visible
 * element, or throws a message listing everything tried.
 *
 * Use sparingly. A candidate list is a smell that a locator is not yet pinned
 * down — it belongs in code that spans all three sites during the period before
 * a `data-testid` exists, not as a permanent pattern.
 */
export async function firstVisible(
  candidates: readonly Locator[],
  description: string,
  timeout = 5_000
): Promise<Locator> {
  if (candidates.length === 0) {
    throw new Error(`firstVisible("${description}") was called with no candidate locators.`);
  }

  // Race every candidate's own auto-waiting `waitFor`. Whichever becomes
  // visible first wins; if none do, every promise rejects and we report the
  // full list. This leans on Playwright's waiting rather than polling by hand.
  const attempts = candidates.map(async (candidate) => {
    await candidate.first().waitFor({ state: 'visible', timeout });
    return candidate.first();
  });

  const results = await Promise.allSettled(attempts);
  const winner = results.find(
    (result): result is PromiseFulfilledResult<Locator> => result.status === 'fulfilled'
  );

  if (winner) return winner.value;

  throw new Error(
    `Could not find a visible element for "${description}" within ${timeout}ms. ` +
      `Tried ${candidates.length} candidate locator(s). ` +
      `If this is a new page, confirm the real DOM rather than adding another guess.`
  );
}

/**
 * SAP Webgui round-trip wait (spec §9.5).
 *
 * Webgui replaces large parts of the DOM on every server round trip, so
 * locators resolved before an action are stale immediately after it. Call this
 * after ANY action that hits the server (Enter, Save, Execute, any button).
 *
 * Sequence:
 *   1. Give the busy indicator a chance to appear (it may be too fast to see).
 *   2. Wait for it to clear.
 *   3. Let the network settle.
 *   4. Caller re-resolves the content frame afterwards.
 *
 * @param page      the top-level page (not the frame — the busy layer is on top)
 * @param timeout   generous by design; ERP round trips are slow (spec §9.5)
 */
export async function waitForRoundTrip(page: Page, timeout = 60_000): Promise<void> {
  // SAP's Unified Rendering busy indicator. `#UR_BUSY` / the greyed-out overlay
  // are the common markers; both are checked because which one appears depends
  // on the backend SP level.
  // TODO: confirm the exact busy-indicator selector against the WOSG QA system —
  // this is the single highest-value thing to verify on first ERP contact.
  const busyIndicator = page.locator('#UR_BUSY, .urBusyIndicator, [id$="_busy"]');

  // 1 + 2: if a busy layer shows up, wait it out. `.waitFor` with a short
  // timeout on 'visible' is tolerant of the indicator never appearing at all.
  await busyIndicator
    .first()
    .waitFor({ state: 'visible', timeout: 1_000 })
    .then(() => busyIndicator.first().waitFor({ state: 'hidden', timeout }))
    .catch(() => {
      // Indicator never appeared, or vanished before we looked. Both are fine —
      // the network wait below is the backstop.
    });

  // 3: Webgui posts a full form round trip, so 'load' is meaningful here in a
  // way it is not on the Spartacus SPA.
  await page.waitForLoadState('load', { timeout }).catch(() => undefined);
}

/**
 * Resolves the Webgui application frame (spec §9.4).
 *
 * Webgui renders inside a frame — commonly `ITSMAIN`, sometimes an
 * `isolated-container` iframe, with modals occasionally in their own layer.
 * Never assume the top-level page.
 *
 * @throws when no known frame is present, with the frame names actually found
 *         so the caller can add the right one rather than guess.
 */
export async function resolveWebguiFrame(page: Page, timeout = 30_000): Promise<Frame> {
  const deadline = Date.now() + timeout;

  // Ordered by observed likelihood. TODO: confirm which of these the WOSG QA
  // system actually uses and collapse this list to the real one.
  const candidateSelectors = [
    'iframe[name="ITSMAIN"]',
    'iframe#ITSMAIN',
    'iframe.isolated-container',
    'iframe[name="isolatedWorkArea"]',
  ];

  while (Date.now() < deadline) {
    for (const selector of candidateSelectors) {
      const handle = await page.$(selector);
      if (handle) {
        const frame = await handle.contentFrame();
        if (frame) return frame;
      }
    }

    // Some Webgui deployments render straight into the main document. If the
    // OK code field is present at top level, there is no frame to resolve.
    const topLevelOkCode = await page.$('#ToolbarOkCode, input[name="okcode"]');
    if (topLevelOkCode) return page.mainFrame();

    await page.waitForLoadState('domcontentloaded', { timeout: 1_000 }).catch(() => undefined);
  }

  const foundFrames = page.frames().map((f) => f.name() || f.url());
  throw new Error(
    `Could not resolve the SAP Webgui content frame within ${timeout}ms.\n` +
      `Tried: ${candidateSelectors.join(', ')}\n` +
      `Frames actually present: ${foundFrames.length > 0 ? foundFrames.join(', ') : '(none)'}\n` +
      `Add the correct frame selector to resolveWebguiFrame() in src/utils/waits.ts.`
  );
}
