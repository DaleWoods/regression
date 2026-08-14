/**
 * SAP GUI for HTML (Webgui) logon screen and session lifecycle (spec §9.6).
 */
import type { Page } from '@playwright/test';
import type { ErpConfig } from '../../../config/types.js';
import { logger } from '../../utils/logger.js';
import { ErpBasePage } from './ErpBasePage.js';

const log = logger('erp-login');

export class ErpLoginPage extends ErpBasePage {
  private readonly config: ErpConfig;

  constructor(page: Page, config: ErpConfig) {
    super(page);
    this.config = config;
  }

  /**
   * Performs a fresh logon and handles the multiple-logons interstitial.
   *
   * `storageState` reuse is deliberately NOT used here. SAP sessions are
   * stateful server-side (MYSAPSSO2 cookie plus a server session), so a restored
   * cookie frequently lands on a dead session that presents as an unexpected
   * screen halfway through a test (§9.6).
   */
  public async login(): Promise<void> {
    await this.page.goto(this.config.baseUrl, { waitUntil: 'domcontentloaded' });
    await this.waitForRoundTrip();

    const frame = await this.contentFrame();

    // The logon screen fields carry stable `name` attributes — one of the few
    // places in Webgui where a name attribute can be trusted, because this
    // screen is served by ITS rather than Unified Rendering.
    const clientField = frame.locator('input[name="sap-client"]');
    const userField = frame.locator('input[name="sap-user"]');
    const passwordField = frame.locator('input[name="sap-password"]');
    const languageField = frame.locator('input[name="sap-language"]');

    await userField.waitFor({ state: 'visible', timeout: 30_000 });

    // The client is often pre-filled and read-only depending on the entry URL.
    if (await clientField.isEditable().catch(() => false)) {
      await clientField.fill(this.config.client);
    }
    await userField.fill(this.config.user);
    await passwordField.fill(this.config.password);
    if (await languageField.isEditable().catch(() => false)) {
      await languageField.fill(this.config.language);
    }

    await passwordField.press('Enter');
    await this.waitForRoundTrip();

    await this.handleMultipleLogons();
    await this.assertLoggedIn();

    log.info('SAP Webgui session established');
  }

  /**
   * Handles the "multiple logons detected" interstitial.
   *
   * If this is not handled explicitly the run hangs on an unexpected screen
   * that no page object recognises. We choose "continue with this logon and end
   * any others" so a session leaked by a previous crashed run is reclaimed
   * rather than blocking this one (§9.6).
   */
  private async handleMultipleLogons(): Promise<void> {
    const frame = await this.contentFrame();

    // TODO: confirm the exact control on the WOSG QA system. The radio's field
    // name is standard across SP levels, but the surrounding markup is not.
    const continueOption = frame
      .locator('input[type="radio"][name*="MULTI_LOGON"]')
      .or(frame.getByText(/continue with this logon.*end any other/i))
      .first();

    const present = await continueOption
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!present) return;

    log.warn('Multiple logons detected — continuing with this session and ending the others');
    await continueOption.click();
    await frame.locator('body').press('Enter');
    await this.waitForRoundTrip();
  }

  /**
   * Confirms the session reached SAP Easy Access rather than an error screen.
   *
   * Bad credentials produce a logon-screen message rather than a thrown error,
   * so without this check the first transaction fails with a confusing
   * "OK code field not found".
   */
  private async assertLoggedIn(): Promise<void> {
    const frame = await this.contentFrame();
    const okCode = frame.locator('#ToolbarOkCode, input[name="okcode"]').first();

    const reachedEasyAccess = await okCode
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    if (!reachedEasyAccess) {
      const status = await this.getStatusMessage();
      throw new Error(
        [
          'SAP logon did not reach Easy Access.',
          status.text !== '' ? `  Status bar [${status.type}]: ${status.text}` : undefined,
          `  Check ERP_USER / ERP_PASSWORD / ERP_CLIENT, and that the QA user is not locked.`,
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
  }

  /**
   * Ends the SAP session explicitly.
   *
   * Not optional housekeeping: an abandoned session is held server-side until it
   * times out and counts against the user's concurrent session limit (commonly
   * six), so skipping this makes the NEXT run fail with "maximum number of
   * sessions reached" (§9.6).
   */
  public async logout(): Promise<void> {
    await this.endTransaction().catch((error: unknown) => {
      // Teardown must not mask a real test failure — log and move on.
      log.warn(`Could not end SAP session cleanly: ${String(error)}`);
    });
  }
}
