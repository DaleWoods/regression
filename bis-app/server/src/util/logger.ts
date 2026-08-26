/**
 * A structured line per error, not a logging framework - this is a real
 * deployment (render.yaml), and "check the logs" needs to mean something
 * more than scrolling past bare stack traces looking for the one that
 * matches the ticket someone's asking about.
 */

type Fields = Record<string, unknown>;

function emit(level: 'error' | 'warn', context: string, fields: Fields): void {
  const line = { ts: new Date().toISOString(), level, context, ...fields };
  const out = level === 'error' ? console.error : console.warn;
  out(JSON.stringify(line));
}

/** `context` is a dotted namespace, e.g. "automation.remind", "jira.writeback", "http.unhandled". */
export function logError(context: string, err: unknown, fields: Fields = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  emit('error', context, { ...fields, message, stack });
}

export function logWarn(context: string, fields: Fields = {}): void {
  emit('warn', context, fields);
}
