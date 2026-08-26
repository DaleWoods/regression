import { Db } from '../db/index.js';
import { Role } from '../domain/types.js';
import { newId } from '../util/id.js';
import { nowIso } from '../util/time.js';

export interface Member {
  id: string;
  name: string;
  email: string;
  team: string;
  role: Role;
  active: boolean;
  entraOid: string | null;
  lastLoginAt: string | null;
}

interface MemberRow {
  id: string;
  name: string;
  email: string;
  team: string;
  role: string;
  active: number;
  entra_oid: string | null;
  last_login_at: string | null;
}

function map(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    team: row.team,
    role: row.role as Role,
    active: Number(row.active) === 1,
    entraOid: row.entra_oid,
    lastLoginAt: row.last_login_at,
  };
}

export async function listMembers(db: Db, includeInactive = true): Promise<Member[]> {
  const rows = await db.all<MemberRow>(
    includeInactive
      ? 'SELECT * FROM members ORDER BY active DESC, name ASC'
      : 'SELECT * FROM members WHERE active = 1 ORDER BY name ASC',
  );
  return rows.map(map);
}

/** The people a round is distributed to and chased for: active committee scorers. */
export async function listActiveScorers(db: Db): Promise<Member[]> {
  const rows = await db.all<MemberRow>(
    "SELECT * FROM members WHERE active = 1 AND role IN ('COMMITTEE', 'COORDINATOR', 'ADMIN') ORDER BY name ASC",
  );
  return rows.map(map);
}

export async function getMember(db: Db, id: string): Promise<Member | undefined> {
  const row = await db.get<MemberRow>('SELECT * FROM members WHERE id = ?', [id]);
  return row ? map(row) : undefined;
}

export async function getMemberByEmail(db: Db, email: string): Promise<Member | undefined> {
  const row = await db.get<MemberRow>('SELECT * FROM members WHERE LOWER(email) = LOWER(?)', [email]);
  return row ? map(row) : undefined;
}

export interface MemberInput {
  id?: string;
  name: string;
  email: string;
  team?: string;
  role?: Role;
  active?: boolean;
}

export async function saveMember(db: Db, input: MemberInput): Promise<Member> {
  const now = nowIso();
  const existing = input.id
    ? await db.get<MemberRow>('SELECT * FROM members WHERE id = ?', [input.id])
    : await db.get<MemberRow>('SELECT * FROM members WHERE LOWER(email) = LOWER(?)', [input.email]);

  if (existing) {
    await db.run('UPDATE members SET name = ?, email = ?, team = ?, role = ?, active = ?, updated_at = ? WHERE id = ?', [
      input.name,
      input.email,
      input.team ?? existing.team,
      input.role ?? existing.role,
      (input.active ?? Number(existing.active) === 1) ? 1 : 0,
      now,
      existing.id,
    ]);
    return (await getMember(db, existing.id)) as Member;
  }

  const id = input.id ?? newId();
  await db.run(
    'INSERT INTO members (id, name, email, team, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, input.name, input.email, input.team ?? '', input.role ?? 'COMMITTEE', (input.active ?? true) ? 1 : 0, now, now],
  );
  return (await getMember(db, id)) as Member;
}

export interface MemberParticipation {
  memberId: string;
  roundsAvailable: number;
  roundsScored: number;
  lastScoredAt: string | null;
}

/**
 * How much of the last N finalised rounds each member actually scored - a
 * valid "Yes" submission on at least one ticket counts as having taken part
 * in that round. Members with zero participation over the window still get
 * an entry (roundsScored: 0), so a coordinator can see who has gone quiet.
 */
export async function memberParticipation(db: Db, memberIds: string[], limit = 8): Promise<MemberParticipation[]> {
  const rounds = await db.all<{ id: string }>(
    `SELECT id FROM rounds WHERE status = 'FINALISED' ORDER BY finalised_at DESC LIMIT ?`,
    [limit],
  );
  const result = new Map<string, MemberParticipation>(
    memberIds.map((id) => [id, { memberId: id, roundsAvailable: rounds.length, roundsScored: 0, lastScoredAt: null }]),
  );
  if (!rounds.length || !memberIds.length) return [...result.values()];

  const roundPlaceholders = rounds.map(() => '?').join(', ');
  const memberPlaceholders = memberIds.map(() => '?').join(', ');
  const rows = await db.all<{ member_id: string; round_id: string; last_at: string }>(
    `SELECT member_id, round_id, MAX(updated_at) AS last_at FROM submissions
     WHERE round_id IN (${roundPlaceholders}) AND member_id IN (${memberPlaceholders})
       AND relevance = 'YES' AND archived = 0
     GROUP BY member_id, round_id`,
    [...rounds.map((r) => r.id), ...memberIds],
  );

  const scoredRoundsByMember = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = scoredRoundsByMember.get(row.member_id) ?? new Set<string>();
    set.add(row.round_id);
    scoredRoundsByMember.set(row.member_id, set);

    const entry = result.get(row.member_id);
    if (entry && (!entry.lastScoredAt || row.last_at > entry.lastScoredAt)) entry.lastScoredAt = row.last_at;
  }
  for (const [memberId, set] of scoredRoundsByMember) {
    const entry = result.get(memberId);
    if (entry) entry.roundsScored = set.size;
  }

  return [...result.values()];
}

export async function recordLogin(db: Db, id: string, entraOid?: string | null): Promise<void> {
  await db.run('UPDATE members SET last_login_at = ?, entra_oid = COALESCE(?, entra_oid), updated_at = ? WHERE id = ?', [
    nowIso(),
    entraOid ?? null,
    nowIso(),
    id,
  ]);
}
