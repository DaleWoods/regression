/**
 * Goldsmiths storefront configuration (SAP Commerce Cloud / Spartacus).
 */
import { baseUrlEnvKey, currentEnvironment, requireEnv } from '../env.js';
import { assertNotProduction } from '../productionGuard.js';
import type { SiteConfig } from '../types.js';

export function goldsmithsConfig(): SiteConfig {
  const environment = currentEnvironment();
  const key = baseUrlEnvKey('GOLDSMITHS', environment);
  const baseUrl = requireEnv(
    key,
    `Goldsmiths base URL for the "${environment}" environment, e.g. https://goldsmiths-uat.thewosgroup.com`
  );

  assertNotProduction(baseUrl, 'Goldsmiths base URL');

  return {
    key: 'goldsmiths',
    displayName: 'Goldsmiths',
    baseUrl,
    currency: 'GBP',
    locale: 'en-GB',
    features: {
      // TODO: confirm each flag with the business before writing tests that
      // depend on it. Values below are the current best understanding and are
      // the switch that decides which specs run (spec §4).
      clickAndCollect: true,
      financeV12: true,
      payPalCredit: true,
      wishlist: true,
      guestCheckout: true,
      appointmentBooking: true,
    },
  };
}
