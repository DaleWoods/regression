import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..', '..');

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export type AuthMode = 'entra' | 'dev';
export type DbDriver = 'postgres' | 'sqlite';

/**
 * All runtime wiring lives here. Business rules (thresholds, categories, effort
 * mapping) are NOT here - they are database-backed config, editable in-app,
 * per requirements §5/§14 ("config-driven, not hard-coded").
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: int(process.env.PORT, 4000),
  // RENDER_EXTERNAL_URL is injected by Render, so email links and the OIDC
  // redirect point at the deployed host without hard-coding it.
  publicWebOrigin: process.env.PUBLIC_WEB_ORIGIN ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173',
  publicApiOrigin: process.env.PUBLIC_API_ORIGIN ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:4000',

  /**
   * Demo deployment switch. Permits email-only sign-in and a SQLite file in a
   * production build, and seeds sample data on first boot, so the app can be
   * hosted for a walkthrough before Entra ID and PostgreSQL are wired up.
   * It is loudly flagged in the server log and banner-marked in the UI.
   * Never turn this on for a deployment holding real scoring data.
   */
  demoMode: bool(process.env.DEMO_MODE, false),
  /** '' | 'base' (committee + config) | 'demo' (also a worked-example round). */
  get seedOnBoot(): string {
    return process.env.SEED_ON_BOOT ?? (env.demoMode ? 'demo' : '');
  },

  db: {
    driver: (process.env.DB_DRIVER ?? (process.env.DATABASE_URL ? 'postgres' : 'sqlite')) as DbDriver,
    url: process.env.DATABASE_URL ?? '',
    sqliteFile: process.env.SQLITE_FILE ?? path.join(serverRoot, 'data', 'bis.db'),
    ssl: bool(process.env.DATABASE_SSL, false),
  },

  auth: {
    mode: (process.env.AUTH_MODE ?? 'dev') as AuthMode,
    sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-insecure-session-secret-change-me',
    sessionTtlHours: int(process.env.SESSION_TTL_HOURS, 12),
    cookieName: process.env.SESSION_COOKIE_NAME ?? 'bis_session',
    cookieSecure: bool(process.env.SESSION_COOKIE_SECURE, process.env.NODE_ENV === 'production'),
    entra: {
      tenantId: process.env.ENTRA_TENANT_ID ?? '',
      clientId: process.env.ENTRA_CLIENT_ID ?? '',
      clientSecret: process.env.ENTRA_CLIENT_SECRET ?? '',
      redirectUri: process.env.ENTRA_REDIRECT_URI ?? 'http://localhost:4000/auth/callback',
      /** Domain(s) allowed to sign in, comma separated. Empty = any tenant user. */
      allowedEmailDomains: (process.env.ENTRA_ALLOWED_EMAIL_DOMAINS ?? '')
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
    },
  },

  jira: {
    baseUrl: (process.env.JIRA_BASE_URL ?? '').replace(/\/+$/, ''),
    email: process.env.JIRA_EMAIL ?? '',
    apiToken: process.env.JIRA_API_TOKEN ?? '',
    get configured(): boolean {
      return Boolean(env.jira.baseUrl && env.jira.email && env.jira.apiToken);
    },
  },

  graph: {
    tenantId: process.env.GRAPH_TENANT_ID ?? process.env.ENTRA_TENANT_ID ?? '',
    clientId: process.env.GRAPH_CLIENT_ID ?? '',
    clientSecret: process.env.GRAPH_CLIENT_SECRET ?? '',
    /** Shared mailbox or coordinator UPN that sends distribution/reminder mail. */
    senderUpn: process.env.GRAPH_SENDER_UPN ?? '',
    /** When false, mail is rendered and logged but never actually sent. */
    sendEnabled: bool(process.env.GRAPH_SEND_ENABLED, false),
    get configured(): boolean {
      return Boolean(env.graph.tenantId && env.graph.clientId && env.graph.clientSecret && env.graph.senderUpn);
    },
  },

  serverRoot,
};

export function assertProductionSafety(): void {
  if (env.nodeEnv !== 'production') return;

  const problems: string[] = [];
  // A signed session cookie is what stands between a stranger and someone
  // else's account, so this is fatal in every production build - demo or not.
  if (env.auth.sessionSecret.startsWith('dev-only')) problems.push('SESSION_SECRET must be set');

  if (env.demoMode) {
    console.warn(
      [
        '',
        '  ********************************************************************',
        '  *  DEMO_MODE is on.                                                *',
        '  *  Anyone who knows a seeded email address can sign in as them,    *',
        '  *  and data lives in a SQLite file rather than PostgreSQL.         *',
        '  *  Fine for a walkthrough. Never for real scoring data.            *',
        '  ********************************************************************',
        '',
      ].join('\n'),
    );
  } else {
    if (env.auth.mode === 'dev') problems.push('AUTH_MODE=dev is not permitted in production (set DEMO_MODE=true if this is a demo)');
    if (env.db.driver !== 'postgres') problems.push('production must run on PostgreSQL (DB_DRIVER=postgres)');
  }

  if (problems.length) throw new Error(`Unsafe production configuration:\n - ${problems.join('\n - ')}`);
}
