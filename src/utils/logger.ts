/**
 * Minimal levelled logger.
 *
 * Playwright's reporter owns test output, so this exists for the things the
 * reporter cannot know about: which site a worker resolved, ERP round trips,
 * and data-integrity warnings. Keep it quiet by default — `LOG_LEVEL=debug`
 * when diagnosing.
 */

const LEVELS = ['error', 'warn', 'info', 'debug'] as const;
export type LogLevel = (typeof LEVELS)[number];

function configuredLevel(): LogLevel {
  const raw = (process.env['LOG_LEVEL'] ?? 'info').toLowerCase();
  return (LEVELS as readonly string[]).includes(raw) ? (raw as LogLevel) : 'info';
}

function enabled(level: LogLevel): boolean {
  return LEVELS.indexOf(level) <= LEVELS.indexOf(configuredLevel());
}

function emit(level: LogLevel, scope: string, message: string): void {
  if (!enabled(level)) return;
  const line = `[${level.toUpperCase()}] [${scope}] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.warn(line);
}

/**
 * Creates a logger bound to a scope, e.g. `logger('erp')` or `logger('site:goldsmiths')`.
 */
export function logger(scope: string): Record<LogLevel, (message: string) => void> {
  return {
    error: (message) => emit('error', scope, message),
    warn: (message) => emit('warn', scope, message),
    info: (message) => emit('info', scope, message),
    debug: (message) => emit('debug', scope, message),
  };
}
