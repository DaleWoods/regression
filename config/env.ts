/**
 * Environment-variable access and startup validation (spec §5).
 *
 * Every URL, credential and key enters the framework through this module. It is
 * the only place `process.env` is read, which makes the "no hard-coded values
 * outside config/ and .env" rule mechanically checkable.
 *
 * The validation is deliberately fail-fast and loud: a missing variable should
 * produce one clear sentence naming the key, not a twenty-minute run that dies
 * on a navigation timeout.
 */
import dotenv from 'dotenv';
import type { EnvironmentName } from './types.js';

dotenv.config();

const VALID_ENVIRONMENTS: readonly EnvironmentName[] = ['dev', 'staging', 'uat'];

/** Thrown for any configuration problem so callers can distinguish it from a test failure. */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/** Reads a required variable, throwing a message that says exactly what to do. */
export function requireEnv(key: string, hint?: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new ConfigurationError(
      [
        `Missing required environment variable: ${key}`,
        hint ? `  ${hint}` : undefined,
        `  Add it to your .env file (copy .env.example if you have not already),`,
        `  or, in CI, add it as a GitHub Secret and map it in the workflow.`,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
  return value.trim();
}

/** Reads an optional variable, falling back to a default. */
export function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

/** Reads an optional integer variable, falling back when absent or unparseable. */
export function optionalIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new ConfigurationError(
      `Environment variable ${key} must be an integer, but was "${raw}".`
    );
  }
  return parsed;
}

/** True when running inside GitHub Actions (or any CI that sets CI=true). */
export const isCI = process.env['CI'] === 'true' || process.env['CI'] === '1';

/** The environment this run targets, validated against the known list. */
export function currentEnvironment(): EnvironmentName {
  const raw = optionalEnv('TEST_ENV', 'uat').toLowerCase();
  if (!VALID_ENVIRONMENTS.includes(raw as EnvironmentName)) {
    throw new ConfigurationError(
      `TEST_ENV="${raw}" is not a known environment. ` +
        `Expected one of: ${VALID_ENVIRONMENTS.join(', ')}.`
    );
  }
  return raw as EnvironmentName;
}

/**
 * Builds the env-var name for a site's base URL, e.g.
 * ('GOLDSMITHS', 'uat') -> 'GOLDSMITHS_BASE_URL_UAT'.
 */
export function baseUrlEnvKey(sitePrefix: string, environment: EnvironmentName): string {
  return `${sitePrefix}_BASE_URL_${environment.toUpperCase()}`;
}

/**
 * Validates that every variable needed for the requested scope is present, and
 * reports ALL missing keys at once rather than one per run — three testers
 * setting up locally should not have to iterate six times.
 *
 * @param keys variables to check
 * @param scope human-readable description used in the error message
 */
export function requireAll(keys: readonly string[], scope: string): void {
  const missing = keys.filter((key) => {
    const value = process.env[key];
    return value === undefined || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new ConfigurationError(
      [
        `Cannot start ${scope}: ${missing.length} required environment variable(s) missing.`,
        ...missing.map((key) => `  - ${key}`),
        '',
        'Copy .env.example to .env and fill these in, or add them as GitHub Secrets in CI.',
      ].join('\n')
    );
  }
}
