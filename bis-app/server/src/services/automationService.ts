import { Db } from '../db/index.js';
import { CadenceConfig } from '../domain/types.js';
import { newId } from '../util/id.js';
import { nowIso } from '../util/time.js';
import { getAppConfig } from './configService.js';
import { sendDistribution, sendReminders } from './emailService.js';
import { Member, getMember, listActiveScorers } from './memberService.js';
import { listRounds, listRoundTickets, markDistributed, setRoundStatus } from './roundService.js';
import { roundProgress } from './submissionService.js';

export type AutomationKind = 'DISTRIBUTE' | 'REMIND' | 'ESCALATE' | 'CLOSE';

interface AutomationLogRow {
  id: string;
  kind: AutomationKind;
  round_id: string;
  status: string;
  detail: string;
  note: string;
  attempts: number;
  ran_at: string;
}

/**
 * Weekday (0=Sunday..6=Saturday, matching Date#getDay) and hour of `at` as
 * seen in `timeZone`, using Intl instead of a date library so the scheduler
 * has no extra dependency. DST-aware because Intl resolves it per-instant.
 */
export function timePartsIn(timeZone: string, at: Date): { dayOfWeek: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at);
  const weekdayAbbr = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { dayOfWeek: Math.max(days.indexOf(weekdayAbbr), 0), hour };
}

async function logAttempt(
  db: Db,
  kind: AutomationKind,
  roundId: string,
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED',
  detail: string,
  attempts: number,
  note = '',
): Promise<void> {
  await db.run(
    `INSERT INTO automation_log (id, kind, round_id, status, detail, note, attempts, ran_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), kind, roundId, status, detail, note, attempts, nowIso()],
  );
}

async function lastAttempt(db: Db, kind: AutomationKind, roundId: string, detail: string): Promise<AutomationLogRow | undefined> {
  return db.get<AutomationLogRow>(
    `SELECT * FROM automation_log WHERE kind = ? AND round_id = ? AND detail = ? ORDER BY ran_at DESC LIMIT 1`,
    [kind, roundId, detail],
  );
}

/** True once, unless the one prior attempt failed - then true exactly once more (§15 auto-retry). */
async function shouldAttempt(db: Db, kind: AutomationKind, roundId: string, detail = ''): Promise<{ go: boolean; attempts: number }> {
  const last = await lastAttempt(db, kind, roundId, detail);
  if (!last) return { go: true, attempts: 1 };
  if (last.status === 'SUCCESS' || last.status === 'SKIPPED') return { go: false, attempts: last.attempts };
  // FAILED: retry exactly once.
  return { go: last.attempts < 2, attempts: last.attempts + 1 };
}

async function autoDistribute(db: Db, cadence: CadenceConfig, now: Date): Promise<void> {
  const { dayOfWeek, hour } = timePartsIn(cadence.timezone, now);
  if (dayOfWeek !== cadence.distributionDayOfWeek || hour !== cadence.distributionHour) return;

  const drafts = (await listRounds(db)).filter((r) => r.status === 'DRAFT' && !r.distributionSentAt);
  for (const round of drafts) {
    const tickets = await listRoundTickets(db, round.id);
    if (!tickets.length) continue; // an empty draft isn't ready - leave it for the coordinator

    const { go, attempts } = await shouldAttempt(db, 'DISTRIBUTE', round.id);
    if (!go) continue;

    try {
      await setRoundStatus(db, round.id, 'OPEN');
      const recipients = await listActiveScorers(db);
      const results = await sendDistribution(db, round, tickets, recipients);
      await markDistributed(db, round.id);
      const failed = results.filter((r) => r.status === 'FAILED').length;
      await logAttempt(db, 'DISTRIBUTE', round.id, failed ? 'FAILED' : 'SUCCESS', '', attempts, `${results.length - failed} sent, ${failed} failed`);
    } catch (err) {
      await logAttempt(db, 'DISTRIBUTE', round.id, 'FAILED', '', attempts, err instanceof Error ? err.message : String(err));
    }
  }
}

async function autoRemindAndEscalate(db: Db, cadence: CadenceConfig, now: Date): Promise<void> {
  const open = (await listRounds(db)).filter((r) => r.status === 'OPEN');
  for (const round of open) {
    const hoursUntilCutOff = (new Date(round.cutOffAt).getTime() - now.getTime()) / 3_600_000;
    if (hoursUntilCutOff < 0) continue; // past cut-off - autoClose handles it

    const thresholds: Array<{ kind: AutomationKind; hours: number }> = [
      ...cadence.reminderHoursBeforeCutOff.map((hours) => ({ kind: 'REMIND' as const, hours })),
      ...(cadence.escalationHoursBeforeCutOff !== null
        ? [{ kind: 'ESCALATE' as const, hours: cadence.escalationHoursBeforeCutOff }]
        : []),
    ];

    for (const { kind, hours } of thresholds) {
      if (hoursUntilCutOff > hours) continue; // hasn't crossed this threshold yet
      const detail = String(hours);
      const { go, attempts } = await shouldAttempt(db, kind, round.id, detail);
      if (!go) continue;

      try {
        const tickets = await listRoundTickets(db, round.id);
        const scorers = await listActiveScorers(db);
        const progress = await roundProgress(db, round.id, scorers, tickets.length);
        const targets: Array<{ member: Member; outstanding: number }> = [];
        for (const row of progress) {
          if (row.outstanding <= 0) continue;
          const member = scorers.find((m) => m.id === row.memberId) ?? (await getMember(db, row.memberId));
          if (member) targets.push({ member, outstanding: row.outstanding });
        }
        if (!targets.length) {
          await logAttempt(db, kind, round.id, 'SKIPPED', detail, attempts, 'Nobody outstanding');
          continue;
        }
        const results = await sendReminders(db, round, targets, kind === 'ESCALATE');
        const failed = results.filter((r) => r.status === 'FAILED').length;
        await logAttempt(db, kind, round.id, failed ? 'FAILED' : 'SUCCESS', detail, attempts, `${results.length - failed} sent, ${failed} failed`);
      } catch (err) {
        await logAttempt(db, kind, round.id, 'FAILED', detail, attempts, err instanceof Error ? err.message : String(err));
      }
    }
  }
}

async function autoClose(db: Db, now: Date): Promise<void> {
  const open = (await listRounds(db)).filter((r) => r.status === 'OPEN' && new Date(r.cutOffAt).getTime() <= now.getTime());
  for (const round of open) {
    const { go, attempts } = await shouldAttempt(db, 'CLOSE', round.id);
    if (!go) continue;
    try {
      await setRoundStatus(db, round.id, 'CLOSED');
      await logAttempt(db, 'CLOSE', round.id, 'SUCCESS', '', attempts, 'Cut-off passed');
    } catch (err) {
      await logAttempt(db, 'CLOSE', round.id, 'FAILED', '', attempts, err instanceof Error ? err.message : String(err));
    }
  }
}

/**
 * One tick of the cadence scheduler (§11, §15): distribute a ready draft at
 * the configured day/hour, chase outstanding members as each reminder
 * threshold is crossed, escalate the same way, and close a round once its
 * cut-off has passed. Finalising and creating rounds stay manual - both are
 * judgment calls (finalising is a one-way door; a round's ticket list is a
 * coordinator's call), not mechanical cadence steps.
 */
export async function runAutomationTick(db: Db, now: Date = new Date()): Promise<void> {
  const config = await getAppConfig(db);
  if (!config.cadence.automationEnabled) return;
  await autoDistribute(db, config.cadence, now);
  await autoRemindAndEscalate(db, config.cadence, now);
  await autoClose(db, now);
}
