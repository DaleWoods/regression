import { Db, upsert } from '../db/index.js';
import { nowIso } from '../util/time.js';
import { HttpishError } from './roundService.js';

export interface DiscussionResolution {
  roundId: string;
  ticketId: string;
  outcome: string;
  note: string;
  agreedScore: number | null;
  resolvedBy: string;
  resolvedAt: string;
}

interface Row {
  round_id: string;
  ticket_id: string;
  outcome: string;
  note: string;
  agreed_score: number | null;
  resolved_by: string;
  resolved_at: string;
}

function map(row: Row): DiscussionResolution {
  return {
    roundId: row.round_id,
    ticketId: row.ticket_id,
    outcome: row.outcome,
    note: row.note,
    agreedScore: row.agreed_score === null ? null : Number(row.agreed_score),
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
  };
}

export async function listDiscussionResolutions(db: Db, roundId: string): Promise<Map<string, DiscussionResolution>> {
  const rows = await db.all<Row>('SELECT * FROM discussion_resolutions WHERE round_id = ?', [roundId]);
  return new Map(rows.map((row) => [row.ticket_id, map(row)]));
}

export interface DiscussionResolutionInput {
  roundId: string;
  ticketId: string;
  outcome: string;
  note?: string;
  agreedScore?: number | null;
  resolvedBy: string;
}

/** Record (or update) what a meeting decided about a held-for-discussion ticket (§10.4). */
export async function saveDiscussionResolution(db: Db, input: DiscussionResolutionInput): Promise<DiscussionResolution> {
  if (!input.outcome.trim()) throw new HttpishError(400, 'An outcome is required');
  if (input.agreedScore !== undefined && input.agreedScore !== null && (input.agreedScore < 0 || input.agreedScore > 70)) {
    throw new HttpishError(400, 'Agreed score must be between 0 and 70');
  }

  const now = nowIso();
  const agreedScore = input.agreedScore ?? null;
  await db.run(
    upsert(
      'discussion_resolutions',
      ['round_id', 'ticket_id', 'outcome', 'note', 'agreed_score', 'resolved_by', 'resolved_at'],
      ['round_id', 'ticket_id'],
    ),
    [input.roundId, input.ticketId, input.outcome.trim(), input.note?.trim() ?? '', agreedScore, input.resolvedBy, now],
  );

  return {
    roundId: input.roundId,
    ticketId: input.ticketId,
    outcome: input.outcome.trim(),
    note: input.note?.trim() ?? '',
    agreedScore,
    resolvedBy: input.resolvedBy,
    resolvedAt: now,
  };
}
