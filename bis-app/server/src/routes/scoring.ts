import { Router } from 'express';
import { z } from 'zod';
import { Db, getDb } from '../db/index.js';
import { requireAuth } from '../auth/middleware.js';
import { RELEVANCE_VALUES, isCoordinator } from '../domain/types.js';
import { isValidSubmission } from '../domain/scoring.js';
import { audit } from '../services/auditService.js';
import { getScoringConfig, listCategories } from '../services/configService.js';
import { listActiveScorers, memberParticipation } from '../services/memberService.js';
import { getActiveRound, getLastFinalisedRound, getRound, isScoringOpen, listRoundTickets } from '../services/roundService.js';
import { listMemberSubmissions, roundProgress, saveSubmission, toScoringInput } from '../services/submissionService.js';
import { getTicket } from '../services/ticketService.js';
import { actorOf, asyncHandler } from './helpers.js';

const router = Router();

/**
 * Social proof for a member's own scoring page: how many of the round's
 * active scorers have responded at all (a count, never who or what they
 * answered - that stays coordinator-only per §9), plus this member's own
 * recent-rounds streak, which is fine to show them since it's about them.
 */
async function memberFacingStats(db: Db, roundId: string, ticketCount: number, memberId: string) {
  const scorers = await listActiveScorers(db);
  const progress = await roundProgress(db, roundId, scorers, ticketCount);
  const respondedCount = progress.filter((p) => p.submitted > 0).length;
  const myParticipation = (await memberParticipation(db, [memberId]))[0] ?? null;
  return {
    participation: { respondedCount, totalScorers: scorers.length },
    myParticipation,
  };
}

/**
 * The committee member's scoring surface: the open round, its ticket cards, and
 * *only their own* submissions (§9).
 */
router.get(
  '/my/round',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const round = await getActiveRound(db);
    if (!round) {
      const lastFinalised = await getLastFinalisedRound(db);
      const lastFinalisedIncludesYou = lastFinalised
        ? (await listMemberSubmissions(db, lastFinalised.id, req.member!.id)).map(toScoringInput).some(isValidSubmission)
        : false;
      res.json({
        round: null,
        tickets: [],
        submissions: [],
        categories: await listCategories(db),
        lastFinalisedRound: lastFinalisedIncludesYou ? lastFinalised : null,
      });
      return;
    }
    const tickets = await listRoundTickets(db, round.id);
    const stats = await memberFacingStats(db, round.id, tickets.length, req.member!.id);
    res.json({
      round,
      scoringOpen: isScoringOpen(round),
      tickets,
      submissions: await listMemberSubmissions(db, round.id, req.member!.id),
      categories: await listCategories(db),
      ...stats,
    });
  }),
);

router.get(
  '/rounds/:id/my-submissions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const round = await getRound(db, req.params.id);
    if (!round) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }
    if (round.status === 'DRAFT' && !isCoordinator(req.member!.role)) {
      res.status(403).json({ error: 'This round has not been distributed yet' });
      return;
    }
    const tickets = await listRoundTickets(db, round.id);
    const stats = await memberFacingStats(db, round.id, tickets.length, req.member!.id);
    res.json({
      round,
      scoringOpen: isScoringOpen(round),
      tickets,
      submissions: await listMemberSubmissions(db, round.id, req.member!.id),
      categories: await listCategories(db),
      ...stats,
    });
  }),
);

const submissionSchema = z.object({
  relevance: z.enum(RELEVANCE_VALUES),
  scores: z.record(z.string(), z.number()).optional(),
  closureReason: z.string().optional(),
  closureInfo: z.string().optional(),
  moreInfo: z.string().optional(),
  durationMs: z.number().min(0).optional(),
});

/**
 * Submit or edit this member's score for one ticket. A member can only ever
 * write their own submission - the member id comes from the session, never the
 * request body.
 */
router.put(
  '/rounds/:roundId/tickets/:ticketId/submission',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = submissionSchema.parse(req.body ?? {});
    const db = await getDb();

    const round = await getRound(db, req.params.roundId);
    if (!round) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }
    const ticket = await getTicket(db, req.params.ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const config = await getScoringConfig(db);
    const submission = await saveSubmission(db, { round, ticket, member: req.member!, payload, config });

    await audit(db, actorOf(req), 'submission.save', 'submission', submission.id, {
      roundId: round.id,
      jiraId: ticket.jiraId,
      relevance: submission.relevance,
      scores: submission.scores,
    });
    res.json({ submission });
  }),
);

export default router;
