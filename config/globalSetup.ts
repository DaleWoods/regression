/**
 * Global setup — runs once, before any browser is launched (spec §5).
 *
 * Two jobs, both fail-fast:
 *   1. Validate that every required environment variable is present.
 *   2. Refuse to run if any resolved target looks like production.
 *
 * Doing this here rather than in a fixture means a misconfigured run costs two
 * seconds and prints one clear message, instead of failing a hundred tests with
 * navigation timeouts.
 */
import type { FullConfig } from '@playwright/test';
import { ConfigurationError, currentEnvironment, requireAll } from './env.js';
import { getAllSiteConfigs, getErpConfig } from './environments.js';
import { assertAllNotProduction, ProductionTargetError } from './productionGuard.js';

/** Which env vars each project family needs before it can run. */
function requiredKeysFor(environment: string): string[] {
  const suffix = environment.toUpperCase();
  return [
    `GOLDSMITHS_BASE_URL_${suffix}`,
    `MAPPIN_WEBB_BASE_URL_${suffix}`,
    `WOS_BASE_URL_${suffix}`,
  ];
}

/**
 * Project names passed via `--project` on the command line.
 *
 * `FullConfig.projects` lists every project DEFINED in the config, not the ones
 * selected for this run, so it cannot answer "is the ERP project running?".
 * Without this distinction a storefront-only run would demand SAP credentials —
 * which would block both the PR-checks job and any tester who does not have ERP
 * access.
 */
function projectsSelectedOnCommandLine(): string[] {
  const selected: string[] = [];

  for (let index = 0; index < process.argv.length; index++) {
    const token = process.argv[index];
    if (token === undefined) continue;

    if (token === '--project') {
      const value = process.argv[index + 1];
      if (value !== undefined) selected.push(value);
    } else if (token.startsWith('--project=')) {
      selected.push(token.slice('--project='.length));
    }
  }

  return selected;
}

/**
 * Whether the ERP project will actually run.
 *
 * With no `--project` filter every configured project runs, so the ERP project
 * is included; otherwise it is included only when named explicitly.
 */
function erpProjectSelected(config: FullConfig): boolean {
  const selected = projectsSelectedOnCommandLine();

  if (selected.length === 0) {
    return config.projects.some((project) => project.name === 'erp');
  }
  return selected.includes('erp');
}

// Synchronous by design: every check here is a pure config read, and keeping it
// sync means a misconfigured run fails before the runner does any other work.
export default function globalSetup(config: FullConfig): void {
  const environment = currentEnvironment();

  try {
    // ---- 1. Storefront environment variables -------------------------------
    requireAll(requiredKeysFor(environment), `a run against "${environment}"`);

    const sites = getAllSiteConfigs();
    const targets = Object.values(sites).map((site) => ({
      url: site.baseUrl,
      label: `${site.displayName} base URL`,
    }));

    // ---- 2. ERP, only when the ERP project is actually selected ------------
    // Resolving ERP config unconditionally would force every storefront-only
    // contributor to hold SAP credentials, which they should not need.
    const erpHost = process.env['ERP_BASE_URL'];

    if (erpProjectSelected(config)) {
      requireAll(
        ['ERP_BASE_URL', 'ERP_CLIENT', 'ERP_USER', 'ERP_PASSWORD'],
        'the ERP (SAP Webgui) project'
      );
      const erp = getErpConfig();
      targets.push({ url: erp.baseUrl, label: 'ERP (SAP Webgui) base URL' });
    } else if (erpHost !== undefined && erpHost.trim() !== '') {
      // Defence in depth: even on a storefront-only run, if an ERP host is
      // configured at all it gets checked. A production ERP URL sitting in a
      // developer's .env is worth catching early, not at the moment it is used.
      targets.push({ url: erpHost.trim(), label: 'ERP (SAP Webgui) base URL' });
    }

    // ---- 3. The hard production guard --------------------------------------
    assertAllNotProduction(targets);

    console.warn(
      `\n  WOSG UK Playwright framework\n` +
        `  Environment : ${environment}\n` +
        targets.map((target) => `  Target      : ${target.label} → ${target.url}`).join('\n') +
        `\n`
    );
  } catch (error) {
    if (error instanceof ProductionTargetError || error instanceof ConfigurationError) {
      // Print cleanly rather than as a stack trace — these messages are written
      // to be read by a tester, not debugged.
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
