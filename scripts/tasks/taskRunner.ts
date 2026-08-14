/**
 * Shared plumbing for the standalone ERP process-task scripts (spec §9.10).
 *
 * These scripts run outside Playwright's test runner, so they need their own
 * argument parsing and error reporting. Both are deliberately plain: the point
 * of a process task is that a tester can run it without ceremony.
 */
import { ConfigurationError } from '../../config/env.js';
import { ProductionTargetError } from '../../config/productionGuard.js';

/** Parsed `--key value` and `--flag` arguments. */
export type TaskArgs = Record<string, string | true>;

/**
 * Parses `--key value` pairs and bare `--flag` switches.
 *
 * @param argv arguments after the script name
 */
export function parseArgs(argv: readonly string[]): TaskArgs {
  const args: TaskArgs = {};

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === undefined || !token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[index + 1];

    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      index++;
    } else {
      args[key] = true;
    }
  }

  return args;
}

/**
 * Reads a required argument, exiting with usage guidance when it is absent.
 *
 * @param args        parsed arguments
 * @param name        argument name, without the leading dashes
 * @param description what the argument is, shown in the error
 */
export function requireArg(args: TaskArgs, name: string, description: string): string {
  const value = args[name];

  if (value === undefined || value === true) {
    throw new ConfigurationError(
      `Missing required argument --${name} (${description}).\n` +
        `  Example: npm run task:<name> -- --${name} <value>`
    );
  }

  return value;
}

/**
 * Runs a task with consistent logging and error handling.
 *
 * Configuration and production-guard errors print as clean messages and exit 1;
 * anything else rethrows with its stack, because an unexpected failure in a
 * process task is a bug worth seeing in full.
 */
export async function runTask(name: string, task: () => Promise<void>): Promise<void> {
  const startedAt = Date.now();
  console.warn(`\n▶ Running ERP task: ${name}`);

  try {
    await task();
    console.warn(`✔ ${name} completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s\n`);
  } catch (error) {
    if (error instanceof ProductionTargetError || error instanceof ConfigurationError) {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }

    console.error(`\n✖ ${name} failed:\n`);
    console.error(error);
    process.exit(1);
  }
}
