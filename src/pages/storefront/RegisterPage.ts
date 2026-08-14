/**
 * Customer account registration page.
 */
import type { Locator, Page } from '@playwright/test';
import type { SiteConfig } from '../../../config/types.js';
import { BasePage } from '../BasePage.js';

/** The fields a new account needs. Produced by `userFactory`. */
export interface RegistrationDetails {
  title?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export class RegisterPage extends BasePage {
  private readonly titleSelect: Locator;
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly confirmPasswordInput: Locator;
  private readonly termsCheckbox: Locator;
  private readonly submitButton: Locator;
  private readonly errorMessage: Locator;

  constructor(page: Page, site: SiteConfig) {
    super(page, site);

    // TODO: confirm accessible names against the real DOM. The label patterns
    // below follow Spartacus defaults and WOSG may have overridden them.
    this.titleSelect = page.getByLabel(/title/i).first();
    this.firstNameInput = page.getByLabel(/first name/i).first();
    this.lastNameInput = page.getByLabel(/last name|surname/i).first();
    this.emailInput = page.getByLabel(/email/i).first();
    // Scoped with an exact-ish pattern so it cannot match "Confirm password".
    this.passwordInput = page.getByLabel(/^password$/i).first();
    this.confirmPasswordInput = page.getByLabel(/confirm password|re-?enter password/i).first();
    this.termsCheckbox = page.getByRole('checkbox', { name: /terms|conditions/i }).first();
    this.submitButton = page
      .getByRole('button', { name: /register|create account|sign up/i })
      .first();
    this.errorMessage = page.getByRole('alert').first();
  }

  protected get path(): string {
    // TODO: confirm the registration path.
    return '/login/register';
  }

  /** Fills and submits the registration form. */
  public async register(details: RegistrationDetails): Promise<void> {
    if (details.title !== undefined) {
      await this.titleSelect.fill(details.title);
    }
    await this.firstNameInput.fill(details.firstName);
    await this.lastNameInput.fill(details.lastName);
    await this.emailInput.fill(details.email);
    await this.passwordInput.fill(details.password);

    if (await this.confirmPasswordInput.isVisible()) {
      await this.confirmPasswordInput.fill(details.password);
    }
    if (await this.termsCheckbox.isVisible()) {
      await this.termsCheckbox.check();
    }

    await this.submitButton.click();
  }

  /** The validation error text, when one is shown. */
  public async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.innerText()).trim();
  }
}
