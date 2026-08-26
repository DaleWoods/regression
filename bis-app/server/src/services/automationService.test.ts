import { describe, expect, it } from 'vitest';
import { Db, createDb } from '../db/index.js';
import { migrate } from '../db/migrate.js';
import { ensureDefaultConfig, ensureSeedCategories, saveConfigSection } from './configService.js';
import { saveMember } from './memberService.js';
import { addTicketToRound, createRound, getRound } from './roundService.js';
import { upsertTicket } from './ticketService.js';
import { runAutomationTick, timePartsIn } from './automationService.js';

describe('timePartsIn', () => {
  it('matches UTC fields directly in the UTC zone', () => {
    const at = new Date('2024-01-01T20:00:00Z'); // a Monday
    expect(timePartsIn('UTC', at)).toEqual({ dayOfWeek: at.getUTCDay(), hour: at.getUTCHours() });
  });

  it('rolls the day over in a zone ahead of UTC (no DST, so the offset is exact)', () => {
    // Kiritimati is UTC+14 year-round. 2024-01-01 20:00 UTC (Monday) + 14h = 2024-01-02 10:00 local (Tuesday).
    const at = new Date('2024-01-01T20:00:00Z');
    expect(timePartsIn('Pacific/Kiritimati', at)).toEqual({ dayOfWeek: 2, hour: 10 });
  });
});

async function setUp() {
  const db: Db = await createDb({ driver: 'sqlite', sqliteFile: ':memory:' });
  await migrate(db);
  await ensureDefaultConfig(db);
  await ensureSeedCategories(db);
  await saveMember(db, { name: 'Scorer', email: 'scorer@example.com', role: 'COMMITTEE' });
  return db;
}

describe('runAutomationTick', () => {
  it('does nothing while automation is off', async () => {
    const db = await setUp();
    const round = await createRound(db, { weekLabel: 'Week 1', cutOffAt: new Date(Date.now() + 3_600_000).toISOString() });
    const ticket = await upsertTicket(db, { jiraId: 'BIS-1', title: 'A ticket' });
    await addTicketToRound(db, round.id, ticket.id);

    await runAutomationTick(db, new Date());
    const after = await getRound(db, round.id);
    expect(after?.status).toBe('DRAFT');
  });

  it('distributes a ready draft once the configured day/hour is reached, and only once', async () => {
    const db = await setUp();
    await saveConfigSection(db, 'cadence', { automationEnabled: true, distributionDayOfWeek: 4, distributionHour: 9, timezone: 'UTC' }, 'test');
    const round = await createRound(db, { weekLabel: 'Week 1', cutOffAt: new Date(Date.now() + 3_600_000).toISOString() });
    const ticket = await upsertTicket(db, { jiraId: 'BIS-2', title: 'Another ticket' });
    await addTicketToRound(db, round.id, ticket.id);

    const thursdayNineUtc = new Date('2024-01-04T09:15:00Z'); // a Thursday
    await runAutomationTick(db, thursdayNineUtc);
    const opened = await getRound(db, round.id);
    expect(opened?.status).toBe('OPEN');
    expect(opened?.distributionSentAt).not.toBeNull();

    // Running again at the same moment must not re-distribute.
    const log = await db.all<{ id: string }>('SELECT id FROM automation_log WHERE kind = ? AND round_id = ?', ['DISTRIBUTE', round.id]);
    await runAutomationTick(db, thursdayNineUtc);
    const logAfter = await db.all<{ id: string }>('SELECT id FROM automation_log WHERE kind = ? AND round_id = ?', ['DISTRIBUTE', round.id]);
    expect(logAfter.length).toBe(log.length);
  });

  it('leaves an empty draft alone even at the distribution slot', async () => {
    const db = await setUp();
    await saveConfigSection(db, 'cadence', { automationEnabled: true, distributionDayOfWeek: 4, distributionHour: 9, timezone: 'UTC' }, 'test');
    const round = await createRound(db, { weekLabel: 'Empty week', cutOffAt: new Date(Date.now() + 3_600_000).toISOString() });

    await runAutomationTick(db, new Date('2024-01-04T09:15:00Z'));
    const after = await getRound(db, round.id);
    expect(after?.status).toBe('DRAFT');
  });

  it('closes an open round once its cut-off has passed', async () => {
    const db = await setUp();
    await saveConfigSection(db, 'cadence', { automationEnabled: true }, 'test');
    const round = await createRound(db, { weekLabel: 'Week 1', cutOffAt: new Date(Date.now() - 60_000).toISOString() });
    const { setRoundStatus } = await import('./roundService.js');
    await setRoundStatus(db, round.id, 'OPEN');

    await runAutomationTick(db, new Date());
    const after = await getRound(db, round.id);
    expect(after?.status).toBe('CLOSED');
  });

  it('sends a reminder once the configured hours-before-cutoff threshold is crossed, and only once', async () => {
    const db = await setUp();
    await saveConfigSection(db, 'cadence', { automationEnabled: true, reminderHoursBeforeCutOff: [24], escalationHoursBeforeCutOff: null }, 'test');
    const round = await createRound(db, { weekLabel: 'Week 1', cutOffAt: new Date(Date.now() + 20 * 3_600_000).toISOString() });
    const { setRoundStatus } = await import('./roundService.js');
    await setRoundStatus(db, round.id, 'OPEN');
    const ticket = await upsertTicket(db, { jiraId: 'BIS-3', title: 'Needs a score' });
    await addTicketToRound(db, round.id, ticket.id);

    await runAutomationTick(db, new Date()); // 20h < 24h threshold, so it should fire
    const log1 = await db.all('SELECT * FROM automation_log WHERE kind = ? AND round_id = ?', ['REMIND', round.id]);
    expect(log1.length).toBe(1);

    await runAutomationTick(db, new Date()); // still under the same threshold - must not fire again
    const log2 = await db.all('SELECT * FROM automation_log WHERE kind = ? AND round_id = ?', ['REMIND', round.id]);
    expect(log2.length).toBe(1);
  });
});
