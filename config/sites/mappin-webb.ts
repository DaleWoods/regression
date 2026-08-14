/**
 * Mappin & Webb storefront configuration (SAP Commerce Cloud / Spartacus).
 */
import { baseUrlEnvKey, currentEnvironment, requireEnv } from '../env.js';
import { assertNotProduction } from '../productionGuard.js';
import type { SiteConfig } from '../types.js';

export function mappinWebbConfig(): SiteConfig {
  const environment = currentEnvironment();
  const key = baseUrlEnvKey('MAPPIN_WEBB', environment);
  const baseUrl = requireEnv(
    key,
    `Mappin & Webb base URL for the "${environment}" environment, e.g. https://mappinandwebb-uat.thewosgroup.com`
  );

  assertNotProduction(baseUrl, 'Mappin & Webb base URL');

  return {
    key: 'mappin-webb',
    displayName: 'Mappin & Webb',
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
