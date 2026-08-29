import { describe, expect, it } from 'vitest';
import { Db, createDb } from '../db/index.js';
import { migrate } from '../db/migrate.js';
import { ensureDefaultConfig, ensureSeedCategories, getScoringConfig, listCategories } from './configService.js';
import { saveMember } from './memberService.js';
import { addTicketToRound, createRound, setRoundStatus } from './roundService.js';
import { saveSubmission } from './submissionService.js';
import { upsertTicket } from './ticketService.js';

async function setUp() {
  const db: Db = await createDb({ driver: 'sqlite', sqliteFile: ':memory:' });
  await migrate(db);
  await ensureDefaultConfig(db);
  await ensureSeedCategories(db);
  let round = await createRound(db, { weekLabel: 'Week 1', cutOffAt: new Date(Date.now() + 3_600_000).toISOString() });
  const ticket = await upsertTicket(db, { jiraId: 'BIS-1', title: 'A ticket' });
  await addTicketToRound(db, round.id, ticket.id);
  round = await setRoundStatus(db, round.id, 'OPEN');
  const member = await saveMember(db, { name: 'Scorer', email: 'scorer@example.com', role: 'COMMITTEE' });
  const categories = await listCategories(db);
  const config = await getScoringConfig(db);
  return { db, round, ticket, member, categories, config };
}

describe('saveSubmission duration tracking', () => {
  it('persists the client-reported durationMs, used as a rubber-stamp signal', async () => {
    const { db, round, ticket, member, categories, config } = await setUp();
    const scores = Object.fromEntries(categories.map((c) => [c.id, 5]));

    const saved = await saveSubmission(db, {
      round,
      ticket,
      member,
      config,
      payload: { relevance: 'YES', scores, durationMs: 42_000 },
    });

    expect(saved.durationMs).toBe(42_000);
  });

  it('leaves durationMs null when the client does not report one', async () => {
    const { db, round, ticket, member, categories, config } = await setUp();
    const scores = Object.fromEntries(categories.map((c) => [c.id, 5]));

    const saved = await saveSubmission(db, {
      round,
      ticket,
      member,
      config,
      payload: { relevance: 'YES', scores },
    });

    expect(saved.durationMs).toBeNull();
  });

  it('updates durationMs on a re-save, reflecting the latest known duration', async () => {
    const { db, round, ticket, member, categories, config } = await setUp();
    const scores = Object.fromEntries(categories.map((c) => [c.id, 5]));

    await saveSubmission(db, { round, ticket, member, config, payload: { relevance: 'YES', scores, durationMs: 1_000 } });
    const second = await saveSubmission(db, { round, ticket, member, config, payload: { relevance: 'YES', scores, durationMs: 9_000 } });

    expect(second.durationMs).toBe(9_000);
  });
});
