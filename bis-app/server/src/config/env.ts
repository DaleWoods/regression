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
   * Three independent deployment choices. They are separate on purpose: a real
   * instance can run on PostgreSQL with live JIRA and no sample data, while
   * still using interim email sign-in for the days between going live and the
   * Entra app registration landing.
   */

  /**
   * Permits email-only sign-in in a production build - the interim route in
   * before Entra ID SSO is configured. Anyone who knows a member's email
   * address can sign in as them, so this is banner-marked in the UI and
   * warned about on every boot. Remove it the moment SSO works.
   */
  allowEmailSignIn: bool(process.env.ALLOW_EMAIL_SIGN_IN, false),

  /** Permits a SQLite file in a production build, instead of PostgreSQL. */
  allowSqlite: bool(process.env.ALLOW_SQLITE, false),

  /** '' (none) | 'base' (committee placeholders) | 'demo' (also a sample round). */
  seedOnBoot: process.env.SEED_ON_BOOT ?? '',

  /**
   * Ensures an admin member exists on boot, so a brand-new instance has a way
   * in. Without it nobody can sign in to a fresh database - sign-in requires a
   * provisioned member, by design (§4).
   */
  bootstrapAdminEmail: (process.env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase(),
  bootstrapAdminName: process.env.BOOTSTRAP_ADMIN_NAME ?? '',

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
  // else's account. Fatal in every production build, whatever else is set.
  if (env.auth.sessionSecret.startsWith('dev-only')) problems.push('SESSION_SECRET must be set');

  if (env.auth.mode === 'dev' && !env.allowEmailSignIn) {
    problems.push(
      'AUTH_MODE=dev is not permitted in production. Configure Entra ID SSO, or set ALLOW_EMAIL_SIGN_IN=true to accept interim email sign-in.',
    );
  }
  if (env.db.driver !== 'postgres' && !env.allowSqlite) {
    problems.push('production should run on PostgreSQL. Set DATABASE_URL, or set ALLOW_SQLITE=true to accept a SQLite file.');
  }
  // An Entra deployment missing its registration cannot sign anyone in; better
  // to fail at boot than to hand every user a broken login.
  if (env.auth.mode === 'entra' && !(env.auth.entra.tenantId && env.auth.entra.clientId && env.auth.entra.clientSecret)) {
    problems.push('AUTH_MODE=entra requires ENTRA_TENANT_ID, ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET');
  }

  if (problems.length) throw new Error(`Unsafe production configuration:\n - ${problems.join('\n - ')}`);

  if (env.allowEmailSignIn && env.auth.mode === 'dev') {
    console.warn(
      [
        '',
        '  ******************************************************************',
        '  *  Interim email sign-in is enabled.                             *',
        '  *  Anyone who knows a member email can sign in as them.          *',
        '  *  Remove ALLOW_EMAIL_SIGN_IN as soon as Entra ID SSO is live.   *',
        '  ******************************************************************',
        '',
      ].join('\n'),
    );
  }
  if (env.db.driver !== 'postgres') {
    console.warn('[bis] running on SQLite in production - move to PostgreSQL before this holds data you cannot lose.');
  }
}
