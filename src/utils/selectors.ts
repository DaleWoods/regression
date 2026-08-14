/**
 * Shared storefront selector constants and locator conventions.
 *
 * PROVENANCE MATTERS. Every entry is tagged:
 *   [VERIFIED]  observed in the live UAT DOM (carried over from the previous
 *               Selenium suite, which ran green against these sites)
 *   [ASSUMED]   Spartacus/OneTrust convention, very likely correct but not yet
 *               confirmed against WOSG's DOM
 *   [TODO]      genuinely unknown — must be confirmed before use
 *
 * Spec §6 locator preference order: getByRole/Label/Text > data-testid >
 * stable CSS > XPath (last resort, must be commented). Prefer building
 * locators in the page object with Playwright's semantic APIs; this file is
 * for the cases where a stable CSS hook genuinely is the best anchor.
 *
 * KNOWN GAP (spec §6): the storefront has almost no `data-testid` attributes.
 * A dev ticket should be raised to add them to the checkout and PDP CTAs; until
 * then several locators below lean on classes that, while stable in practice,
 * are Spartacus/theme-level rather than test contracts.
 */

/** OneTrust consent banner. [VERIFIED] — id confirmed on all three UAT sites. */
export const COOKIE_BANNER = {
  acceptButtonId: '#onetrust-accept-btn-handler',
  rejectButtonId: '#onetrust-reject-all-handler',
  bannerSdk: '#onetrust-banner-sdk',
  /** Text fallbacks used when the id is absent (theme variations). [VERIFIED] */
  acceptTextPatterns: [/^Accept All Cookies$/i, /^Accept All$/i, /^Accept$/i],
} as const;

/**
 * Product listing page tiles. [VERIFIED] — these class hooks were in active use
 * by the previous suite against Goldsmiths UAT.
 */
export const PLP = {
  tile: 'div.productTile, li.productTile, .productTileGrid .productTile',
  /** Every product tile links to a PDP whose path contains `/p/`. [VERIFIED] */
  pdpLinkInTile: "a[href*='/p/']",
} as const;

/**
 * Product detail page. [VERIFIED] — Spartacus add-to-cart form, confirmed in use.
 */
export const PDP = {
  addToCartForm: "form[class*='addToCartForm']",
  addToCartButton: "form[class*='addToCartForm'] button[type='submit'][class*='addToCartButton']",
} as const;

/** Mini-bag drawer. [VERIFIED] — copy and bag link confirmed. */
export const MINI_CART = {
  bagLink: "a[href*='/shopping-bag']",
  headingPattern: /your shopping bag/i,
  viewBagPattern: /view shopping bag/i,
} as const;

/** Cart page. [VERIFIED] — heading and CTA copy confirmed. */
export const CART = {
  headingPattern: /shopping bag|cart/i,
  checkoutCtaPattern: /checkout securely/i,
} as const;

/**
 * Checkout. Class hooks prefixed `sp` are WOSG's own Spartacus components —
 * they are stable because they are bespoke, not framework-generated. [VERIFIED]
 */
export const CHECKOUT = {
  guestEmailInput: "input[type='email']",
  continueAsGuestPattern: /continue as (a )?guest/i,

  /** AFD address lookup typeahead. [VERIFIED] */
  addressLookupInput: 'input.spAddressLookup',
  addressSuggestionList: 'ul.afd-typeahead-list',
  addressSuggestionItem: 'ul.afd-typeahead-list li',
  addressSummary: '.spAddressSummary, .spDeliveryAddressSummary',
  enterManuallyPattern: /enter address manually/i,
  confirmAddressPattern: /confirm address/i,
  continueToPaymentPattern: /continue to payment/i,

  /** Adyen secured fields render in titled iframes. [VERIFIED] */
  cardNumberIframe: "iframe[title='Iframe for card number']",
  expiryIframe: "iframe[title='Iframe for expiry date']",
  cvcIframe: "iframe[title='Iframe for security code']",
  encryptedCardNumberInput: "input[name='encryptedCardNumber']",
  encryptedExpiryInput: "input[name='encryptedExpiryDate']",
  encryptedSecurityCodeInput: "input[name='encryptedSecurityCode']",

  /** Payment method selection and place-order CTA. [VERIFIED] */
  cardPaymentBlock: "div.spCheckoutPaymentOptionBlock[data-action='cardPaymentComponent']",
  placeOrderButton: "button[data-action='placeOrder']",
  placeOrderPattern: /pay by debit\/credit card/i,
} as const;

/** Order confirmation. [VERIFIED] — heading copy confirmed. */
export const ORDER_CONFIRMATION = {
  headingPattern: /thank you|order confirmation/i,
  orderReferencePattern: /order (reference|number)/i,
} as const;

/**
 * Known category paths, used for direct navigation in setup flows.
 * [VERIFIED] on Goldsmiths; TODO: confirm the equivalent paths on Mappin & Webb
 * and Watches of Switzerland — the taxonomy is believed to be shared but has
 * not been checked.
 */
export const CATEGORY_PATHS = {
  watches: '/c/Watches',
  mensWatches: '/c/Watches/Mens-Watches',
  ladiesWatches: '/c/Watches/Ladies-Watches',
} as const;
