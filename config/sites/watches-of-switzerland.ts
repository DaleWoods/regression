/**
 * Watches of Switzerland storefront configuration (SAP Commerce Cloud / Spartacus).
 */
import { baseUrlEnvKey, currentEnvironment, requireEnv } from '../env.js';
import { assertNotProduction } from '../productionGuard.js';
import type { SiteConfig } from '../types.js';

export function watchesOfSwitzerlandConfig(): SiteConfig {
  const environment = currentEnvironment();
  const key = baseUrlEnvKey('WOS', environment);
  const baseUrl = requireEnv(
    key,
    `Watches of Switzerland base URL for the "${environment}" environment, e.g. https://watches-uat.thewosgroup.com`
  );

  assertNotProduction(baseUrl, 'Watches of Switzerland base URL');

  return {
    key: 'wos',
    displayName: 'Watches of Switzerland',
    baseUrl,
    currency: 'GBP',
    locale: 'en-GB',
    features: {
      // TODO: confirm each flag with the business (spec §4).
      clickAndCollect: true,
      financeV12: true,
      payPalCredit: true,
      wishlist: true,
      guestCheckout: true,
      appointmentBooking: true,
    },
  };
}
