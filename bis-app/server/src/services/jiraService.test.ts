import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Db, createDb } from '../db/index.js';
import { migrate } from '../db/migrate.js';
import { ensureDefaultConfig, ensureSeedCategories, saveConfigSection } from '../services/configService.js';
import { saveDiscussionResolution } from '../services/discussionService.js';
import { saveMember } from '../services/memberService.js';
import { addTicketToRound, createRound, setRoundStatus } from '../services/roundService.js';
import { saveSubmission } from '../services/submissionService.js';
import { upsertTicket } from '../services/ticketService.js';

vi.mock('../integrations/jira.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../integrations/jira.js')>();
  return {
    ...actual,
    writeBusinessScore: vi.fn().mockResolvedValue(undefined),
    transitionIssue: vi.fn().mockResolvedValue('Ready For Estimation'),
  };
});

vi.mock('../config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/env.js')>();
  return {
    ...actual,
    env: {
      ...actual.env,
      jira: { ...actual.env.jira, configured: true },
    },
  };
});

const { writeBackRound } = await import('./jiraService.js');
const { getAppConfig } = await import('./configService.js');

async function setUp() {
  const db: Db = await createDb({ driver: 'sqlite', sqliteFile: ':memory:' });
  await migrate(db);
  await ensureDefaultConfig(db);
  await ensureSeedCategories(db);
  await saveConfigSection(db, 'jira', { businessScoreFieldId: 'customfield_10099', transitionOnFinalise: false, transitionName: 'RA: Ready for Estimation' }, 'test');
  await saveConfigSection(db, 'scoring', { minSubmissions: 5 }, 'test');

  let round = await createRound(db, { weekLabel: 'Test round', cutOffAt: new Date(Date.now() + 86_400_000).toISOString() });
  const ticket = await upsertTicket(db, { jiraId: 'BIS-1', title: 'A ticket' });
  await addTicketToRound(db, round.id, ticket.id);
  round = await setRoundStatus(db, round.id, 'OPEN');

  const config = await getAppConfig(db);
  const categories = await (await import('./configService.js')).listCategories(db);

  async function scoreIt(email: string, relevance: 'YES' | 'UNSURE' = 'YES') {
    const member = await saveMember(db, { name: email, email, role: 'COMMITTEE' });
    const scores: Record<string, number> = {};
    if (relevance === 'YES') {
      for (const category of categories) scores[category.id] = 5;
    }
    await saveSubmission(db, {
      round,
      ticket,
      member,
      payload: { relevance, scores },
      config: config.scoring,
    });
  }

  async function scoreTotal(email: string, total: number) {
    const member = await saveMember(db, { name: email, email, role: 'COMMITTEE' });
    const base = Math.floor(total / categories.length);
    let remainder = total % categories.length;
    const scores: Record<string, number> = {};
    for (const category of categories) {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      scores[category.id] = base + extra;
    }
    await saveSubmission(db, { round, ticket, member, payload: { relevance: 'YES', scores }, config: config.scoring });
  }

  return { db, round, ticket, config, scoreIt, scoreTotal };
}

describe('writeBackRound', () => {
  const actor = { id: 'coordinator', name: 'Coordinator', email: 'coordinator@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('writes a ticket below the minimum response count under force, and transitions it once transitionOnFinalise is switched on - without needing force to matter for the transition itself', async () => {
    const { db, round, scoreIt } = await setUp();
    await scoreIt('a@example.com');
    await scoreIt('b@example.com');
    await scoreIt('c@example.com'); // 3 of 5 - below minSubmissions

    const first = await writeBackRound(db, actor, round, { force: true });
    expect(first[0].status).toBe('SUCCESS');
    expect(first[0].transitionedTo).toBe(''); // transitionOnFinalise still off

    await saveConfigSection(db, 'jira', { transitionOnFinalise: true }, 'test');
    const roundAfter = round; // status/id unchanged

    const second = await writeBackRound(db, actor, roundAfter, { force: true });
    expect(second[0].status).toBe('SUCCESS');
    expect(second[0].transitionedTo).not.toBe('');
  });

  it('explains a shortfall caused by non-Yes answers, not just a low count', async () => {
    const { db, round, scoreIt } = await setUp();
    await scoreIt('a@example.com', 'YES');
    await scoreIt('b@example.com', 'YES');
    await scoreIt('c@example.com', 'YES');
    await scoreIt('d@example.com', 'UNSURE');

    const entries = await writeBackRound(db, actor, round, {});
    expect(entries[0].status).toBe('SKIPPED');
    expect(entries[0].reason).toContain('3 of the 5 responses needed');
    expect(entries[0].reason).toContain('4 submitted in total');
    expect(entries[0].reason).toContain('1 answered something other than "Yes"');
  });

  it('does not re-write a ticket that is already written with the same score', async () => {
    const { db, round, scoreIt } = await setUp();
    for (const email of ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com', 'e@example.com']) {
      await scoreIt(email);
    }

    const first = await writeBackRound(db, actor, round, {});
    expect(first[0].status).toBe('SUCCESS');

    const second = await writeBackRound(db, actor, round, {});
    expect(second[0].status).toBe('SKIPPED');
    expect(second[0].reason).toBe('Already written with this score');
  });

  it('a discussion held ticket stays skipped until a meeting agrees a score, then writes that score', async () => {
    const { db, round, ticket, scoreTotal } = await setUp();
    // Wide spread (0..70 across 5 members) pushes std dev well past the default threshold of 16.
    await scoreTotal('a@example.com', 0);
    await scoreTotal('b@example.com', 70);
    await scoreTotal('c@example.com', 35);
    await scoreTotal('d@example.com', 5);
    await scoreTotal('e@example.com', 65);

    const held = await writeBackRound(db, actor, round, {});
    expect(held[0].status).toBe('SKIPPED');
    expect(held[0].reason).toContain('Held for discussion');

    // Recording an outcome without an agreed score still doesn't unblock write-back.
    await saveDiscussionResolution(db, {
      roundId: round.id,
      ticketId: ticket.id,
      outcome: 'Discussed, needs another look',
      resolvedBy: 'Coordinator',
    });
    const stillHeld = await writeBackRound(db, actor, round, {});
    expect(stillHeld[0].status).toBe('SKIPPED');
    expect(stillHeld[0].reason).toContain('no agreed score was recorded');

    // Recording an agreed score makes it write-back eligible, even under force being unnecessary.
    await saveDiscussionResolution(db, {
      roundId: round.id,
      ticketId: ticket.id,
      outcome: 'Send for estimation',
      agreedScore: 42,
      resolvedBy: 'Coordinator',
    });
    const resolved = await writeBackRound(db, actor, round, {});
    expect(resolved[0].status).toBe('SUCCESS');
    expect(resolved[0].businessScore).toBe(42);
  });
});
