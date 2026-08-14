/**
 * Base class for every SAP GUI for HTML (Webgui) page object (spec §9).
 *
 * This class carries the defensive machinery that makes Webgui automation
 * survivable. Read §9 of the requirements pack before changing anything here.
 *
 * Four hard-won rules are encoded below:
 *   1. Navigate with the OK code field, never the Easy Access menu tree (§9.2).
 *   2. Never use generated IDs as locators — use `src/utils/sapLocators` (§9.3).
 *   3. Resolve the content frame; never assume the top-level page (§9.4).
 *   4. Call `waitForRoundTrip()` after EVERY action that hits the server (§9.5).
 */
import type { Frame, Locator, Page } from '@playwright/test';
import { sapOkCodeField, sapStatusBar } from '../../utils/sapLocators.js';
import { resolveWebguiFrame, waitForRoundTrip } from '../../utils/waits.js';
import { logger } from '../../utils/logger.js';

const log = logger('erp');

/** SAP status message types, as reported in the status bar (§9.7). */
export type SapMessageType = 'S' | 'W' | 'E' | 'A' | 'I' | 'UNKNOWN';

/** A parsed status bar message. */
export interface SapStatusMessage {
  type: SapMessageType;
  text: string;
}

export abstract class ErpBasePage {
  protected readonly page: Page;

  /**
   * Cached content frame. Invalidated after every round trip because Webgui
   * replaces the frame's DOM wholesale, which makes any Locator built against
   * the previous resolution stale.
   */
  private cachedFrame: Frame | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  // -------------------------------------------------------------------------
  // Frame handling (§9.4)
  // -------------------------------------------------------------------------

  /**
   * The Webgui application frame. ALL page objects locate through this — never
   * through `this.page` directly.
   *
   * Re-resolves when the cache has been invalidated by a round trip.
   */
  public async contentFrame(): Promise<Frame> {
    if (this.cachedFrame !== null && !this.cachedFrame.isDetached()) {
      return this.cachedFrame;
    }
    this.cachedFrame = await resolveWebguiFrame(this.page);
    return this.cachedFrame;
  }

  /** Drops the cached frame so the next access re-resolves it. */
  protected invalidateFrame(): void {
    this.cachedFrame = null;
  }

  // -------------------------------------------------------------------------
  // Round trips (§9.5)
  // -------------------------------------------------------------------------

  /**
   * Waits for a server round trip to complete and re-resolves the content frame.
   *
   * Call after Enter, Save, Execute, and any button press. There is no
   * `waitForTimeout` anywhere in this framework — a lint rule enforces it.
   */
  public async waitForRoundTrip(): Promise<void> {
    await waitForRoundTrip(this.page);
    this.invalidateFrame();
    await this.contentFrame();
  }

  // -------------------------------------------------------------------------
  // Navigation via the OK code field (§9.2)
  // -------------------------------------------------------------------------

  /**
   * Runs a transaction by typing `/n<TCODE>` into the OK code field.
   *
   * This is the single biggest stability win available in Webgui automation:
   * the menu tree is slow, deeply nested, and re-arranges whenever a role
   * changes, whereas the command box is a stable contract.
   *
   * The `/n` prefix ends the current transaction first, so this works from any
   * screen — including one left dirty by a previous failure.
   *
   * @param tcode transaction code, e.g. 'VL02N'. The `/n` prefix is added here;
   *              do not include it.
   */
  public async runTransaction(tcode: string): Promise<void> {
    log.info(`Running transaction /n${tcode}`);
    const frame = await this.contentFrame();
    const okCode = sapOkCodeField(frame);

    await okCode.waitFor({ state: 'visible', timeout: 30_000 });
    await okCode.fill(`/n${tcode}`);
    await okCode.press('Enter');
    await this.waitForRoundTrip();

    // A transaction that fails to open reports it in the status bar rather than
    // by staying put, so surface that immediately instead of letting the next
    // locator time out mysteriously.
    await this.assertNoErrorMessage(`opening transaction ${tcode}`);
  }

  /** Goes back one screen (the F3 equivalent). */
  public async back(): Promise<void> {
    const frame = await this.contentFrame();
    await sapOkCodeField(frame).fill('/n');
    await sapOkCodeField(frame).press('Enter');
    await this.waitForRoundTrip();
  }

  /** Ends the current transaction (`/nend`), returning to Easy Access. */
  public async endTransaction(): Promise<void> {
    const frame = await this.contentFrame();
    await sapOkCodeField(frame).fill('/nend');
    await sapOkCodeField(frame).press('Enter');
    await this.waitForRoundTrip();
  }

  /**
   * Presses a function key.
   *
   * @param key e.g. 'F3' (back), 'F8' (execute). Webgui maps these to server
   *            round trips, so the wait afterwards is mandatory.
   */
  public async pressFunctionKey(key: string): Promise<void> {
    const frame = await this.contentFrame();
    await frame.locator('body').press(key);
    await this.waitForRoundTrip();
  }

  /** Saves the current document (Ctrl+S). */
  public async save(): Promise<void> {
    const frame = await this.contentFrame();
    await frame.locator('body').press('Control+s');
    await this.waitForRoundTrip();
  }

  // -------------------------------------------------------------------------
  // Status bar (§9.7)
  // -------------------------------------------------------------------------

  /**
   * Reads the status bar message and its type.
   *
   * SAP reports success and failure here rather than by navigating, so most ERP
   * assertions read this. A red (E/A) message is a failure even when the screen
   * looks correct.
   *
   * @returns the message, or `{ type: 'UNKNOWN', text: '' }` when the bar is empty
   */
  public async getStatusMessage(): Promise<SapStatusMessage> {
    const frame = await this.contentFrame();
    const bar = sapStatusBar(frame);

    if (!(await bar.isVisible().catch(() => false))) {
      return { type: 'UNKNOWN', text: '' };
    }

    const text = (await bar.innerText().catch(() => '')).trim();
    if (text === '') {
      return { type: 'UNKNOWN', text: '' };
    }

    return { type: await this.resolveMessageType(bar), text };
  }

  /**
   * Determines the message type from the status bar's own markup.
   *
   * Unified Rendering exposes this differently depending on SP level — as an
   * icon class, a `data-*` attribute, or an id suffix — so several signals are
   * checked before falling back to reading the text.
   *
   * TODO: once the WOSG backend version is confirmed (open item, §15), collapse
   * this to the one signal that system actually emits.
   */
  private async resolveMessageType(bar: Locator): Promise<SapMessageType> {
    const container = bar.locator('xpath=ancestor-or-self::*[@id][1]');

    const classAttr = ((await container.getAttribute('class').catch(() => '')) ?? '').toLowerCase();
    const idAttr = ((await container.getAttribute('id').catch(() => '')) ?? '').toLowerCase();
    const combined = `${classAttr} ${idAttr}`;

    if (/error|abort|msgerror|urmsgbarerr/.test(combined)) return 'E';
    if (/warn/.test(combined)) return 'W';
    if (/success|msgsucc/.test(combined)) return 'S';
    if (/info/.test(combined)) return 'I';

    // Fall back to the message text. SAP prefixes many messages with a code,
    // and error text is highly conventional.
    const text = ((await bar.innerText().catch(() => '')) ?? '').toLowerCase();
    if (/^error|cannot|not possible|does not exist|is locked|no authorization/.test(text)) {
      return 'E';
    }
    return 'UNKNOWN';
  }

  /**
   * Throws when the status bar holds an error or abort message.
   *
   * Called automatically after `runTransaction`. Call it after any other round
   * trip where a red message would otherwise be silently ignored (§9.7).
   *
   * @param context what was being attempted, used in the error message
   */
  public async assertNoErrorMessage(context: string): Promise<void> {
    const message = await this.getStatusMessage();
    if (message.type === 'E' || message.type === 'A') {
      throw new Error(
        `SAP reported an error while ${context}.\n` +
          `  Status bar [${message.type}]: ${message.text}\n` +
          `  A red status message is a failure even when the screen looks correct (spec §9.7).`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Popups (§9.7)
  // -------------------------------------------------------------------------

  /**
   * Dismisses a modal dialog if one is showing.
   *
   * Webgui pops information dialogs mid-flow ("Do you want to save?", document
   * hints) that silently derail a test by swallowing the next click.
   *
   * @param buttonTitle which button to press, defaulting to the green tick
   */
  public async dismissPopupIfPresent(buttonTitle: string = 'Continue'): Promise<boolean> {
    const frame = await this.contentFrame();
    // TODO: confirm the modal container on the WOSG QA system. These are the
    // standard Unified Rendering popup markers.
    const popup = frame.locator('.urPopupWindow, [role="dialog"], #popup').first();

    const present = await popup
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch(() => false);

    if (!present) return false;

    log.debug(`Dismissing popup with "${buttonTitle}"`);
    const button = popup
      .locator(`[title*="${buttonTitle}"]`)
      .or(popup.getByRole('button', { name: new RegExp(buttonTitle, 'i') }))
      .first();

    await button.click();
    await this.waitForRoundTrip();
    return true;
  }

  /**
   * Waits for an EXPECTED popup and returns its text, failing clearly if it
   * does not appear. Use when a dialog is part of the flow under test rather
   * than an interruption to tolerate.
   *
   * @param titleFragment distinctive text expected in the dialog
   */
  public async expectPopup(titleFragment: string): Promise<string> {
    const frame = await this.contentFrame();
    const popup = frame.locator('.urPopupWindow, [role="dialog"], #popup').first();

    await popup.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {
      throw new Error(
        `Expected a popup containing "${titleFragment}" but none appeared within 15s. ` +
          `Either the flow changed, or the popup container selector in ErpBasePage needs confirming.`
      );
    });

    const text = (await popup.innerText()).trim();
    if (!text.toLowerCase().includes(titleFragment.toLowerCase())) {
      throw new Error(
        `A popup appeared but did not contain "${titleFragment}".\n  Popup text: ${text}`
      );
    }
    return text;
  }

  // -------------------------------------------------------------------------
  // ALV grids and table controls (§9.8)
  // -------------------------------------------------------------------------

  /**
   * Finds a row by the text of one of its cells, scrolling in page increments.
   *
   * ALV grids are VIRTUALISED — only visible rows exist in the DOM — so this
   * cannot be replaced with a simple locator, and "assert on all rows" is never
   * valid. Filter down using SAP's own selection fields first; use this to grab
   * the row that remains.
   *
   * Gives up with a clear message rather than looping forever (§9.8).
   *
   * @param cellText exact cell text to match
   * @param maxPages how many page-downs to attempt before giving up
   */
  public async findRowByCellText(cellText: string, maxPages = 20): Promise<Locator> {
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
      const frame = await this.contentFrame();
      const row = frame.locator(`xpath=//tr[.//*[normalize-space(text())="${cellText}"]]`).first();

      if (await row.isVisible().catch(() => false)) {
        return row;
      }

      // Page down within the grid and let the server re-render the window.
      await frame.locator('body').press('PageDown');
      await this.waitForRoundTrip();
    }

    throw new Error(
      `Could not find a grid row containing "${cellText}" after paging ${maxPages} times.\n` +
        `  ALV grids are virtualised, so the row may exist but never render.\n` +
        `  Filter or search down to the expected row using SAP's own selection ` +
        `fields before asserting (spec §9.8).`
    );
  }
}
