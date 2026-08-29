import { useEffect, useState } from 'react';
import { api, formatDateTime, type Category, type Member, type Relevance, type Round, type Submission, type Ticket } from '../api';
import { TicketCard } from '../components/TicketCard';
import { ScoreForm } from '../components/ScoreForm';
import { Link } from '../router';

interface Props {
  member: Member;
  roundId?: string;
}

/** The committee member's view: score the open round, see only your own answers (§9). */
export function ScorePage({ member, roundId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [round, setRound] = useState<Round | null>(null);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [relevanceOptions, setRelevanceOptions] = useState<Array<{ value: Relevance; label: string }>>([]);
  const [closureReasons, setClosureReasons] = useState<string[]>([]);
  const [lastFinalisedRound, setLastFinalisedRound] = useState<Round | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [model, data] = await Promise.all([
          api.scoringModel(),
          roundId ? api.myRoundSubmissions(roundId) : api.myRound(),
        ]);
        if (cancelled) return;
        setRelevanceOptions(model.relevanceOptions);
        setClosureReasons(model.closureReasons);
        setRound(data.round);
        setScoringOpen(Boolean(data.scoringOpen));
        setTickets(data.tickets);
        setCategories(data.categories);
        setSubmissions(data.submissions);
        setLastFinalisedRound('lastFinalisedRound' in data ? (data.lastFinalisedRound ?? null) : null);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the round');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="status error">{error}</p>;

  if (!round) {
    return (
      <>
        <h1>Scoring</h1>
        <div className="notice">There is no open scoring round at the moment. You will get an email when the next round opens.</div>
        {lastFinalisedRound ? (
          <div className="notice" role="status" style={{ marginTop: '1rem' }}>
            The round you scored, <strong>{lastFinalisedRound.weekLabel}</strong>, has finished.{' '}
            <Link to={`/feedback/${lastFinalisedRound.id}`}>See how your scores compared to the committee's</Link>.
          </div>
        ) : null}
      </>
    );
  }

  const done = submissions.length;
  const outstanding = Math.max(tickets.length - done, 0);

  function scrollToTicket(ticketId: string) {
    document.getElementById(`ticket-${ticketId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function jumpToNextUnscored() {
    const next = tickets.find((t) => !submissions.some((s) => s.ticketId === t.id));
    if (next) scrollToTicket(next.id);
  }

  return (
    <>
      <h1>{round.weekLabel}</h1>
      <p className="lede">
        Score each ticket 0–10 across the seven categories. Cut-off <strong>{formatDateTime(round.cutOffAt)}</strong>. You
        can change your answers until then. Nobody else sees your individual scores while the round is open.
      </p>

      <div className="notice" role="status">
        You have scored <strong>{done}</strong> of <strong>{tickets.length}</strong> tickets
        {outstanding > 0 ? ` — ${outstanding} to go.` : ' — all done, thank you.'}
      </div>

      {!scoringOpen ? (
        <div className="notice warn">
          Scoring is closed for this round ({round.status === 'OPEN' ? 'the cut-off has passed' : round.status.toLowerCase()}).
        </div>
      ) : null}

      {scoringOpen && tickets.length > 1 ? (
        <nav className="progress-rail" aria-label="Ticket progress">
          <div className="progress-rail-badges">
            {tickets.map((ticket) => {
              const isDone = submissions.some((s) => s.ticketId === ticket.id);
              return (
                <button
                  key={ticket.id}
                  type="button"
                  className={`progress-badge ${isDone ? 'done' : 'pending'}`}
                  onClick={() => scrollToTicket(ticket.id)}
                  title={`${ticket.jiraId} — ${isDone ? 'scored' : 'not yet scored'}`}
                >
                  {ticket.jiraId}
                </button>
              );
            })}
          </div>
          {outstanding > 0 ? (
            <button type="button" className="secondary" onClick={jumpToNextUnscored}>
              Jump to next unscored ({outstanding} left)
            </button>
          ) : null}
        </nav>
      ) : null}

      {tickets.map((ticket) => {
        const submission = submissions.find((s) => s.ticketId === ticket.id);
        return (
          <div id={`ticket-${ticket.id}`} key={ticket.id}>
            <TicketCard ticket={ticket}>
              <ScoreForm
                ticket={ticket}
                categories={categories}
                relevanceOptions={relevanceOptions}
                closureReasons={closureReasons}
                submission={submission}
                memberEmail={member.email}
                disabled={!scoringOpen}
                disabledReason="Scoring is closed for this round."
                onSave={async (payload) => {
                  const { submission: saved } = await api.saveSubmission(round.id, ticket.id, payload);
                  setSubmissions((current) => [...current.filter((s) => s.ticketId !== ticket.id), saved]);
                }}
              />
            </TicketCard>
          </div>
        );
      })}
    </>
  );
}
