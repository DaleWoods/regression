/**
 * Checkout — guest identification, delivery address, and Adyen card payment.
 *
 * WOSG's checkout is a three-step flow within one page object because the steps
 * share a URL and a component tree; splitting it would create page objects that
 * cannot be navigated to independently.
 *
 * Payment values come from environment variables only — never from code (§8).
 */
import type { FrameLocator, Locator, Page } from '@playwright/test';
import type { SiteConfig } from '../../../config/types.js';
import { CHECKOUT } from '../../utils/selectors.js';
import { BasePage } from '../BasePage.js';

/** Personal details captured at the delivery step. */
export interface DeliveryDetails {
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
}

/** Card details, supplied from env vars by the test data layer. */
export interface CardDetails {
  number: string;
  expiry: string;
  cvc: string;
}

export class CheckoutPage extends BasePage {
  // --- Step 1: identification ---
  private readonly guestEmailInput: Locator;
  private readonly continueAsGuestButton: Locator;

  // --- Step 2: delivery ---
  private readonly titleSelect: Locator;
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly phoneInput: Locator;
  private readonly addressLookupInput: Locator;
  private readonly addressSuggestions: Locator;
  private readonly addressSummary: Locator;
  private readonly enterManuallyButton: Locator;
  private readonly confirmAddressButton: Locator;
  private readonly continueToPaymentButton: Locator;

  // --- Step 3: payment ---
  private readonly cardPaymentOption: Locator;
  private readonly cardNumberFrame: FrameLocator;
  private readonly expiryFrame: FrameLocator;
  private readonly cvcFrame: FrameLocator;
  private readonly placeOrderButton: Locator;

  constructor(page: Page, site: SiteConfig) {
    super(page, site);

    // [VERIFIED] All locators in this constructor were in active use by the
    // previous Selenium suite against Goldsmiths UAT and are carried over.

    this.guestEmailInput = page.locator(CHECKOUT.guestEmailInput).first();
    this.continueAsGuestButton = page
      .getByRole('button', { name: CHECKOUT.continueAsGuestPattern })
      .first();

    // TODO: confirm the title control type — the previous suite sent keystrokes
    // to it, which works for both a select and a combobox, so it is genuinely
    // unresolved. `getByLabel` is the correct approach once confirmed.
    this.titleSelect = page.getByLabel(/title/i).first();
    this.firstNameInput = page.getByLabel(/first name/i).first();
    this.lastNameInput = page.getByLabel(/last name|surname/i).first();
    this.phoneInput = page.getByLabel(/phone|telephone|mobile/i).first();

    // [VERIFIED] AFD address finder — WOSG-bespoke `sp*`/`afd-*` classes. These
    // are stable precisely because they are bespoke rather than framework-generated.
    this.addressLookupInput = page.locator(CHECKOUT.addressLookupInput).first();
    this.addressSuggestions = page.locator(CHECKOUT.addressSuggestionItem);
    this.addressSummary = page.locator(CHECKOUT.addressSummary).first();
    this.enterManuallyButton = page
      .getByRole('button', { name: CHECKOUT.enterManuallyPattern })
      .first();
    this.confirmAddressButton = page
      .getByRole('button', { name: CHECKOUT.confirmAddressPattern })
      .first();
    this.continueToPaymentButton = page
      .getByRole('button', { name: CHECKOUT.continueToPaymentPattern })
      .first();

    // [VERIFIED] Adyen secured fields render in titled iframes.
    this.cardPaymentOption = page.locator(CHECKOUT.cardPaymentBlock).first();
    this.cardNumberFrame = page.frameLocator(CHECKOUT.cardNumberIframe);
    this.expiryFrame = page.frameLocator(CHECKOUT.expiryIframe);
    this.cvcFrame = page.frameLocator(CHECKOUT.cvcIframe);
    this.placeOrderButton = page
      .locator(CHECKOUT.placeOrderButton)
      .or(page.getByRole('button', { name: CHECKOUT.placeOrderPattern }))
      .first();
  }

  protected get path(): string {
    return '/checkout';
  }

  // -------------------------------------------------------------------------
  // Step 1 — identification
  // -------------------------------------------------------------------------

  /** Enters an email address and continues as a guest. */
  public async continueAsGuest(email: string): Promise<void> {
    await this.guestEmailInput.fill(email);
    await this.continueAsGuestButton.click();
  }

  // -------------------------------------------------------------------------
  // Step 2 — delivery
  // -------------------------------------------------------------------------

  /** Fills the personal details block. */
  public async enterDeliveryDetails(details: DeliveryDetails): Promise<void> {
    await this.titleSelect.fill(details.title);
    await this.firstNameInput.fill(details.firstName);
    await this.lastNameInput.fill(details.lastName);
    await this.phoneInput.fill(details.phone);
  }

  /**
   * Searches the AFD address finder and selects the first suggestion.
   *
   * @param query typically a postcode
   */
  public async selectAddressByLookup(query: string): Promise<void> {
    await this.addressLookupInput.fill(query);
    // The typeahead debounces; waiting for the first suggestion to be visible is
    // the correct synchronisation point.
    await this.addressSuggestions.first().waitFor({ state: 'visible', timeout: 15_000 });
    await this.addressSuggestions.first().click();
    await this.addressSummary.waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** The confirmed delivery address as displayed in the summary block. */
  public async getConfirmedAddress(): Promise<string> {
    return (await this.addressSummary.innerText()).trim();
  }

  /** Switches to manual address entry. */
  public async enterAddressManually(): Promise<void> {
    await this.enterManuallyButton.click();
  }

  /** Confirms the selected address, where the site requires an explicit step. */
  public async confirmAddress(): Promise<void> {
    await this.confirmAddressButton.click();
  }

  /** Advances from delivery to payment. */
  public async continueToPayment(): Promise<void> {
    await this.continueToPaymentButton.click();
  }

  // -------------------------------------------------------------------------
  // Step 3 — payment
  // -------------------------------------------------------------------------

  /** Selects credit/debit card as the payment method. */
  public async selectCardPayment(): Promise<void> {
    await this.cardPaymentOption.click();
    // The Adyen component mounts its iframes asynchronously after selection.
    await this.cardNumberFrame
      .locator(CHECKOUT.encryptedCardNumberInput)
      .waitFor({ state: 'visible', timeout: 30_000 });
  }

  /**
   * Enters card details into the Adyen secured fields.
   *
   * Each field lives in its own cross-origin iframe, so they must be filled
   * through their frame locators rather than the page. The card number is
   * entered first because Adyen re-mounts the other fields once it detects the
   * card brand.
   */
  public async enterCardDetails(card: CardDetails): Promise<void> {
    await this.cardNumberFrame.locator(CHECKOUT.encryptedCardNumberInput).fill(card.number);
    await this.expiryFrame.locator(CHECKOUT.encryptedExpiryInput).fill(card.expiry);
    await this.cvcFrame.locator(CHECKOUT.encryptedSecurityCodeInput).fill(card.cvc);
  }

  /** Places the order. */
  public async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
  }
}
