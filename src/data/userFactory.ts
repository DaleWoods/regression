/**
 * Fresh account generation (spec §8).
 *
 * Accounts are created per run, never shared. A shared login makes any test that
 * mutates account state — address book, wishlist, order history — order-dependent
 * and impossible to run in parallel.
 */
import { randomUUID } from 'node:crypto';
import { optionalEnv, requireEnv } from '../../config/env.js';
import type { RegistrationDetails } from '../pages/storefront/RegisterPage.js';

/** A generated account, including the details needed to sign back in. */
export interface GeneratedUser extends RegistrationDetails {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Delivery details used by checkout flows. */
export interface GeneratedAddress {
  title: string;
  phone: string;
  street: string;
  city: string;
  postcode: string;
}

/**
 * Generates a unique email address.
 *
 * Uses plus-addressing so every account routes to one real inbox while staying
 * unique: `qa.auto+<timestamp>-<uuid>@<domain>`. The timestamp makes accounts
 * sortable by run when auditing UAT data build-up.
 */
export function generateEmail(): string {
  const domain = optionalEnv('TEST_USER_EMAIL_DOMAIN', 'thewosgroup.com');
  const timestamp = Date.now();
  const unique = randomUUID().split('-')[0] ?? 'x';
  return `qa.auto+${timestamp}-${unique}@${domain}`;
}

/**
 * Creates a fresh user record.
 *
 * The password comes from an env var rather than being generated, so a tester
 * can sign in manually to inspect an account that a test left behind.
 */
export function createUser(overrides: Partial<GeneratedUser> = {}): GeneratedUser {
  return {
    title: 'Mr',
    firstName: 'QA',
    lastName: `Auto${Date.now().toString().slice(-6)}`,
    email: generateEmail(),
    password: requireEnv('TEST_USER_PASSWORD', 'Password used for all generated test accounts'),
    ...overrides,
  };
}

/**
 * A known-good UK delivery address for checkout.
 *
 * The postcode must resolve in the AFD address finder, so this is a real,
 * deliverable address rather than a random string.
 * TODO: confirm with the business which UAT address is sanctioned for automated
 * order placement.
 */
export function createAddress(overrides: Partial<GeneratedAddress> = {}): GeneratedAddress {
  return {
    title: 'Mr',
    phone: '7123456789',
    street: '1 Bradshaw Drive',
    city: 'Leicester',
    postcode: 'LE6 7LY',
    ...overrides,
  };
}

/**
 * Card details for the happy-path checkout, sourced entirely from env vars.
 *
 * Never hard-code card values (§8). OPEN ITEM (§15): confirm the default UAT
 * payment method and sanctioned test card.
 */
export function getTestCard(): { number: string; expiry: string; cvc: string } {
  return {
    number: requireEnv('PAYMENT_CARD_NUMBER', 'Adyen UAT test card number'),
    expiry: requireEnv('PAYMENT_CARD_EXPIRY', 'Test card expiry in MM/YY format'),
    cvc: requireEnv('PAYMENT_CARD_CVC', 'Test card security code'),
  };
}
