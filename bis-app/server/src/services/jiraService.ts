import { Db } from '../db/index.js';
import { env } from '../config/env.js';
import { AppConfig } from '../domain/types.js';
import { resolveEffort } from '../domain/scoring.js';
import * as jira from '../integrations/jira.js';
import { newId } from '../util/id.js';
import { nowIso } from '../util/time.js';
import { AuditActor, audit } from './auditService.js';
import { getAppConfig } from './configService.js';
import { HttpishError, Round, addTicketToRound } from './roundService.js';
import { computeRoundResults } from './resultService.js';
import { listDiscussionResolutions } from './discussionService.js';
import { Ticket, upsertTicket } from './ticketService.js';

export interface ImportDuplicate {
  jiraId: string;
  otherRoundId: string;
  otherRoundLabel: string;
}

export interface ImportResult {
  imported: Ticket[];
  addedToRound: number;
  /** Tickets added that are already sitting in another draft/open round - not blocked, just flagged. */
  duplicates: ImportDuplicate[];
  /** Imported tickets with no resolvable effort estimate, so they'll show no priority ratio until one's added. */
  missingEffort: string[];
}

/** Read the Business Scoring queue and bring it into the app (§12.1). */
export async function importQueue(
  db: Db,
  actor: AuditActor,
  options: { roundId?: string; jql?: string; maxResults?: number } = {},
): Promise<ImportResult> {
  const config = await getAppConfig(db);
  const inputs = await jira.searchQueue(
    config.jira,
    { backendFieldId: config.scoring.effort.backendFieldId, frontendFieldId: config.scoring.effort.frontendFieldId },
    { jql: options.jql, maxResults: options.maxResults },
  );

  const imported: Ticket[] = [];
  const duplicates: ImportDuplicate[] = [];
  const missingEffort: string[] = [];

  for (const input of inputs) {
    // preserveAuthored: a re-sync refreshes JIRA fields but never clobbers the
    // coordinator's executive summary or four panels (§7).
    const ticket = await upsertTicket(db, input, { preserveAuthored: true });
    imported.push(ticket);

    if (resolveEffort(ticket, config.scoring) === null) missingEffort.push(ticket.jiraId);

    if (options.roundId) {
      const existingElsewhere = await db.get<{ round_id: string; week_label: string }>(
        `SELECT rt.round_id, r.week_label FROM round_tickets rt
         JOIN rounds r ON r.id = rt.round_id
         WHERE rt.ticket_id = ? AND rt.round_id != ? AND r.status IN ('DRAFT', 'OPEN')`,
        [ticket.id, options.roundId],
      );
      if (existingElsewhere) {
        duplicates.push({ jiraId: ticket.jiraId, otherRoundId: existingElsewhere.round_id, otherRoundLabel: existingElsewhere.week_label });
      }
      await addTicketToRound(db, options.roundId, ticket.id);
    }
  }

  await audit(db, actor, 'jira.import', 'round', options.roundId ?? '', {
    jql: options.jql ?? config.jira.queueJql,
    count: imported.length,
    duplicates: duplicates.length,
    missingEffort: missingEffort.length,
  });

  return { imported, addedToRound: options.roundId ? imported.length : 0, duplicates, missingEffort };
}

/** Refresh RA poker effort (and status) for tickets already in the app (§10.4). */
export async function refreshTicketFromJira(db: Db, ticket: Ticket, config: AppConfig): Promise<Ticket> {
  const input = await jira.getIssue(ticket.jiraId, config.jira, {
    backendFieldId: config.scoring.effort.backendFieldId,
    frontendFieldId: config.scoring.effort.frontendFieldId,
  });
  return upsertTicket(db, input, { preserveAuthored: true });
}

export interface WriteBackEntry {
  jiraId: string;
  businessScore: number | null;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  reason?: string;
  transitionedTo?: string;
}

/**
 * Write the computed business score back to JIRA (§12.1).
 *
 * Idempotent (§14): the round+ticket+score triple is the idempotency key, so
 * re-running after a partial failure only retries what did not land, and
 * re-running after success is a no-op.
 */
export async function writeBackRound(
  db: Db,
  actor: AuditActor,
  round: Round,
  options: { force?: boolean } = {},
): Promise<WriteBackEntry[]> {
  const config = await getAppConfig(db);
  if (!env.jira.configured) throw new jira.JiraNotConfiguredError();
  if (!config.jira.businessScoreFieldId) {
    throw new HttpishError(
      400,
      'No JIRA Business Score field id configured. Set it in Settings (use "Resolve field ids from JIRA").',
    );
  }

  const results = await computeRoundResults(db, round, { config: config.scoring });
  const resolutions = await listDiscussionResolutions(db, round.id);
  const entries: WriteBackEntry[] = [];

  for (const { ticket, aggregate } of results) {
    if (aggregate.businessScore === null) {
      entries.push({ jiraId: ticket.jiraId, businessScore: null, status: 'SKIPPED', reason: 'No valid submissions' });
      continue;
    }

    // A split committee gets talked through, not silently averaged into JIRA -
    // not even under force, which only ever overrides the response-count gate.
    // The one way past this gate is a meeting agreeing an explicit score.
    const resolution = aggregate.discussionRequired ? resolutions.get(ticket.id) : undefined;
    const agreedScore = resolution?.agreedScore ?? null;
    if (aggregate.discussionRequired && agreedScore === null) {
      entries.push({
        jiraId: ticket.jiraId,
        businessScore: aggregate.businessScore,
        status: 'SKIPPED',
        reason: resolution
          ? `Discussed (${resolution.outcome}), but no agreed score was recorded to write`
          : 'Held for discussion – scores were too far apart to average',
      });
      continue;
    }

    const businessScore = agreedScore ?? aggregate.businessScore;
    const key = `${round.id}:${ticket.id}:${businessScore}`;

    // Fetched up front so `force` can also override the min-submissions gate
    // below: a ticket already written under a prior override must stay
    // write-able (e.g. to pick up the transition) without needing the
    // override a second time.
    const existing = await db.get<{ id: string; status: string; attempts: number }>(
      'SELECT id, status, attempts FROM jira_writebacks WHERE idempotency_key = ?',
      [key],
    );
    const alreadyWritten = existing?.status === 'SUCCESS';

    if (!aggregate.minSubmissionsMet && agreedScore === null && !options.force && !alreadyWritten) {
      const nonYes = aggregate.submissionsCount - aggregate.responsesCount;
      entries.push({
        jiraId: ticket.jiraId,
        businessScore: aggregate.businessScore,
        status: 'SKIPPED',
        reason:
          `${aggregate.responsesCount} of the ${config.scoring.minSubmissions} responses needed – rolls over to the next round` +
          (nonYes > 0
            ? ` (${aggregate.submissionsCount} submitted in total; ${nonYes} answered something other than "Yes", which doesn't count toward this)`
            : ''),
      });
      continue;
    }
    if (alreadyWritten && !options.force) {
      entries.push({
        jiraId: ticket.jiraId,
        businessScore,
        status: 'SKIPPED',
        reason: 'Already written with this score',
      });
      continue;
    }

    const id = existing?.id ?? newId();
    const attempts = Number(existing?.attempts ?? 0) + 1;
    const now = nowIso();
    if (existing) {
      await db.run('UPDATE jira_writebacks SET status = ?, attempts = ?, updated_at = ? WHERE id = ?', [
        'PENDING',
        attempts,
        now,
        id,
      ]);
    } else {
      await db.run(
        `INSERT INTO jira_writebacks (id, round_id, ticket_id, jira_id, business_score, idempotency_key, status, attempts, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
        [id, round.id, ticket.id, ticket.jiraId, businessScore, key, attempts, now, now],
      );
    }

    try {
      await jira.writeBusinessScore(ticket.jiraId, config.jira.businessScoreFieldId, businessScore);

      // aggregate.sendForEstimation requires minSubmissionsMet, which a forced
      // or already-written ticket may not have - the gates above are the real
      // authority on whether this ticket is ready to move.
      let transitionedTo = '';
      if (config.jira.transitionOnFinalise) {
        transitionedTo = await jira.transitionIssue(ticket.jiraId, config.jira.transitionName);
      }

      await db.run('UPDATE jira_writebacks SET status = ?, error = ?, transitioned_to = ?, updated_at = ? WHERE id = ?', [
        'SUCCESS',
        '',
        transitionedTo,
        nowIso(),
        id,
      ]);
      await audit(db, actor, 'jira.writeback', 'ticket', ticket.id, {
        jiraId: ticket.jiraId,
        businessScore,
        transitionedTo,
      });
      entries.push({ jiraId: ticket.jiraId, businessScore, status: 'SUCCESS', transitionedTo });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.run('UPDATE jira_writebacks SET status = ?, error = ?, updated_at = ? WHERE id = ?', [
        'FAILED',
        message,
        nowIso(),
        id,
      ]);
      await audit(db, actor, 'jira.writeback.failed', 'ticket', ticket.id, { jiraId: ticket.jiraId, error: message });
      entries.push({ jiraId: ticket.jiraId, businessScore, status: 'FAILED', reason: message });
    }
  }

  return entries;
}

export interface WriteBackRow {
  jiraId: string;
  businessScore: number | null;
  status: string;
  attempts: number;
  transitionedTo: string;
  error: string;
  updatedAt: string;
}

export async function listWriteBacks(db: Db, roundId: string): Promise<WriteBackRow[]> {
  const rows = await db.all<any>('SELECT * FROM jira_writebacks WHERE round_id = ? ORDER BY updated_at DESC', [roundId]);
  return rows.map((row) => ({
    jiraId: row.jira_id,
    businessScore: row.business_score,
    status: row.status,
    attempts: Number(row.attempts),
    transitionedTo: row.transitioned_to,
    error: row.error,
    updatedAt: row.updated_at,
  }));
}
