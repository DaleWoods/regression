/**
 * Customer sign-in page.
 */
import type { Locator, Page } from '@playwright/test';
import type { SiteConfig } from '../../../config/types.js';
import { BasePage } from '../BasePage.js';

export class LoginPage extends BasePage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly signInButton: Locator;
  private readonly errorMessage: Locator;
  private readonly forgotPasswordLink: Locator;

  constructor(page: Page, site: SiteConfig) {
    super(page, site);

    // Semantic locators (spec §6 preference 1). These follow the accessible
    // names Spartacus ships by default.
    // TODO: confirm the exact accessible names against the real DOM — WOSG may
    // have overridden the labels.
    this.emailInput = page.getByLabel(/email/i).first();
    this.passwordInput = page.getByLabel(/password/i).first();
    this.signInButton = page.getByRole('button', { name: /sign in|log in/i }).first();
    this.errorMessage = page.getByRole('alert').first();
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot.*password/i }).first();
  }

  protected get path(): string {
    // TODO: confirm the login path. Spartacus default is /login; WOSG may route
    // sign-in through /login or /account/login.
    return '/login';
  }

  /** Signs in with the supplied credentials. */
  public async signIn(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  /** The validation or authentication error text, when one is shown. */
  public async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.innerText()).trim();
  }

  /** Whether an error is currently displayed. */
  public async hasError(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  /** Navigates to the password reset flow. */
  public async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }
}
