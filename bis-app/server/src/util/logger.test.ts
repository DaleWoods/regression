import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logError, logWarn } from './logger.js';

describe('logger', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('logError writes a single structured JSON line with the error message, context and fields', () => {
    logError('jira.writeback', new Error('boom'), { roundId: 'r1', jiraId: 'BIS-1' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(line.level).toBe('error');
    expect(line.context).toBe('jira.writeback');
    expect(line.message).toBe('boom');
    expect(line.roundId).toBe('r1');
    expect(line.jiraId).toBe('BIS-1');
    expect(typeof line.ts).toBe('string');
    expect(typeof line.stack).toBe('string');
  });

  it('logError copes with a non-Error thrown value', () => {
    logError('automation.close', 'not an Error object');
    const line = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(line.message).toBe('not an Error object');
    expect(line.stack).toBeUndefined();
  });

  it('logWarn writes to console.warn, not console.error', () => {
    logWarn('email.reminder', { roundId: 'r1' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    const line = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(line.level).toBe('warn');
    expect(line.roundId).toBe('r1');
  });
});
