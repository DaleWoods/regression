import type React from 'react';

/**
 * This page is part of the feature, not a description of it. If a change to
 * the app changes what a user sees or has to do, update the matching section
 * here in the same commit - a guide that describes behaviour the app no
 * longer has is worse than no guide.
 */

const contents: Array<[string, string]> = [
  ['what-is-this', 'What this app is for'],
  ['relevance', 'Answering "is this relevant?"'],
  ['scoring', 'Scoring a ticket'],
  ['business-score', 'How the business score is worked out'],
  ['lifecycle', 'The life of a round'],
  ['running-a-round', 'Coordinator: running a round'],
  ['jira', 'Getting scores into JIRA'],
  ['feedback', 'The feedback view'],
];

export function GuidePage() {
  return (
    <>
      <h1>Guide</h1>
      <p className="lede">How Business Impact Scoring actually works, section by section.</p>

      <nav aria-label="Guide contents" className="guide-toc">
        <ul>
          {contents.map(([id, title], index) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={() => {
                  // A browser only auto-opens a closed <details> when the
                  // :target fragment lands *inside* it - not when the id sits
                  // on the <details> element itself, which is our case here.
                  const el = document.getElementById(id);
                  if (el instanceof HTMLDetailsElement) el.open = true;
                }}
              >
                <span className="guide-toc-index">{index + 1}</span>
                {title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="what-is-this" title="What this app is for" index={1} defaultOpen>
        <p>
          Each week a batch of JIRA tickets goes in front of the committee. Every member scores each ticket 0–10
          across seven categories, independently and without seeing anyone else's answers. Once enough of the
          committee has responded, the average becomes the ticket's <strong>business score out of 70</strong> and
          that number is written back to JIRA.
        </p>
        <p>
          The point of scoring blind is that it is a genuine independent read on priority, not a negotiation. Nobody
          — including the coordinator — sees an individual member's scores while the round is open. After the round
          finishes, everyone can see how the committee scored each ticket and how their own score compared, but never
          who scored what.
        </p>
      </Section>

      <Section id="relevance" title='Answering "is this relevant?"' index={2}>
        <p>Before scoring a ticket, you answer one question about it:</p>
        <ul>
          <li>
            <strong>Yes – It aligns with Business Strategy.</strong> This is the only answer that opens the 0–10
            category scores. Everything else skips scoring for that ticket.
          </li>
          <li>
            <strong>Unsure – I don't understand the request.</strong> Use this rather than guessing. An Unsure answer
            doesn't count toward the response total the round needs, and it doesn't count against you either — it
            just means one fewer opinion feeding the average.
          </li>
          <li>
            <strong>No – This ticket can be closed.</strong> Needs a reason. A single "can be closed" vote is enough
            to flag the ticket for the coordinator — it doesn't need everyone to agree.
          </li>
          <li>
            <strong>No – This ticket isn't relevant today.</strong> Only the person who originally raised the ticket
            can give this answer; everyone else won't see it as an option for that ticket.
          </li>
        </ul>
        <p className="hint">Only "Yes" answers count toward a ticket's business score.</p>
      </Section>

      <Section id="scoring" title="Scoring a ticket" index={3}>
        <p>A "Yes" opens seven sliders, one per category, each 0–10:</p>
        <ul>
          <li>
            <strong>Commercial Impact</strong> — revenue generation or cost savings.
          </li>
          <li>
            <strong>Operational Impact</strong> — reduces manual effort, speeds up workflows, automates repetitive
            work.
          </li>
          <li>
            <strong>Support Strain</strong> — reduces customer service or internal support demand.
          </li>
          <li>
            <strong>Client / User Impact</strong> — improves UX/UI or end-user satisfaction, including accessibility.
          </li>
          <li>
            <strong>Strategic Alignment</strong>, <strong>Data &amp; Reporting Value</strong> and{' '}
            <strong>Reputational / Brand Risk</strong> — the remaining three, each scored the same way.
          </li>
        </ul>
        <p>
          Each slider shows a rough reference point (minor / moderate / significant) between the 0 and 10 labels, so
          picking a number in the middle isn't a guess. The ticket's four detail panels (Current, Impacts, Future,
          Benefits) start collapsed behind a "Show details" button — the executive summary above them is meant to be
          enough on its own for most tickets; expand for the full detail when you need it.
        </p>
        <p>
          When you open a round, you'll see roughly how long the tickets left to score will take, how many of the
          committee have already responded, and your own streak over recent rounds — all just for context, not a
          target to hit.
        </p>
        <p>
          You can change your answer for a ticket as many times as you like until the round's cut-off. Your answers
          save automatically a few seconds after each change — there's no need to click a button after every ticket
          — and the button on each ticket still saves immediately if you want to be sure before moving on. Once the
          cut-off passes, the form disables itself for that round.
        </p>
        <p>
          When a round has more than one ticket, a bar at the top shows every ticket in the round as a small badge —
          green once you've scored it — so you can click straight to whichever one you haven't done yet, or use
          "Jump to next unscored" to skip ahead.
        </p>
      </Section>

      <Section id="business-score" title="How the business score is worked out" index={4}>
        <p>
          A ticket's business score is the <strong>average of every valid "Yes" submission's total</strong> (the sum
          of its seven category scores, 0–70), rounded to the nearest whole number. Submissions that answered
          anything other than "Yes" don't contribute to the average — they're excluded entirely, not counted as
          zero.
        </p>
        <p>A ticket needs a minimum number of valid "Yes" responses (5, unless changed in Settings) before its score is considered final and ready to send. Below that, it rolls over to the next round automatically.</p>
        <p>
          If the spread between individual scores is too wide (standard deviation over 16, by default), the ticket
          is <strong>held for discussion</strong> instead of being averaged and sent — a split committee gets talked
          through at a meeting, not silently smoothed into one number.
        </p>
        <p>
          Once a business score is final, it's compared against the ticket's development effort (RA poker estimate)
          to produce a <strong>priority ratio</strong>, and from that a priority band: High (ratio ≥ 6), Medium
          (ratio ≥ 1.8), or Low. A ticket held for discussion, or missing an effort estimate, has no priority ratio
          yet.
        </p>
      </Section>

      <Section id="lifecycle" title="The life of a round" index={5}>
        <p>A round moves through four states, always in this order:</p>
        <ul>
          <li>
            <strong>Draft</strong> — the coordinator is still assembling tickets. Nobody else can see it.
          </li>
          <li>
            <strong>Open</strong> — the committee can score it, up until the cut-off.
          </li>
          <li>
            <strong>Closed</strong> — scoring has stopped, but nothing is final yet.
          </li>
          <li>
            <strong>Finalised</strong> — results are locked in permanently and the feedback view opens for everyone.
          </li>
        </ul>
        <p>Only one round is ever open for scoring at a time.</p>
      </Section>

      <Section id="running-a-round" title="Coordinator: running a round" index={6}>
        <p>From a round's page, a coordinator can:</p>
        <ul>
          <li>
            <strong>Import from JIRA</strong> — pulls in the configured queue (or a one-off JQL override) and adds
            each ticket to the round. Nothing is blocked, but the result flags anything worth a second look: a
            ticket already sitting in another draft/open round, and a ticket with no effort estimate yet (it'll
            show no priority ratio until one's added).
          </li>
          <li>
            <strong>Distribute to committee</strong> — opens the round (if it's still a draft) and emails every
            active committee member.
          </li>
          <li>
            <strong>Chase non-responders</strong> — sends a reminder only to members with outstanding tickets.
          </li>
          <li>
            <strong>Close scoring</strong> — stops new submissions before the cut-off, if needed.
          </li>
          <li>
            <strong>Finalise round</strong> — freezes the results and opens the feedback view. This can't be undone
            from the app, so it's worth checking the results table first.
          </li>
        </ul>
        <p>
          The results table on the round page is live while the round is open — responses, business score, spread
          and priority band update as scores come in, so there's no need to wait for the round to close to see how
          it's shaping up.
        </p>
        <p>
          The submission progress table's <strong>Quality</strong> column flags two things worth a second look,
          purely for your own judgement — nothing here blocks a submission: a member scoring every category
          identically on a ticket, and a save that landed suspiciously soon after the form was opened. Hover the
          flag to see which tickets triggered it.
        </p>
        <p>
          Distributing, chasing, escalating and closing can also run on a schedule — switch on "Run this on a
          schedule" under Cadence in Settings, and a ready draft goes out and outstanding members get chased
          automatically at the times set there. It's off by default, and finalising a round is never automatic —
          that stays a deliberate action.
        </p>
      </Section>

      <Section id="jira" title="Getting scores into JIRA" index={7}>
        <p>
          Once a round is finalised, <strong>Write scores to JIRA</strong> writes each ticket's business score to
          its JIRA issue, and (if switched on in Settings) transitions it to the "ready for estimation" status.
          Writing is safe to run more than once — a ticket that's already been written with the same score is
          skipped, not written twice.
        </p>
        <p>
          A ticket below the minimum response count is skipped and explained, for example{' '}
          <em>"3 of the 5 responses needed – rolls over to the next round"</em>. If some of the shortfall is because
          people answered Unsure or No rather than not responding at all, that's called out too, so a coordinator
          isn't left wondering why the count looks low when responses clearly came in.
        </p>
        <p>
          <strong>Write to JIRA anyway</strong> writes those below-minimum tickets too, for when the coordinator
          judges the responses in hand are enough. It never overrides a ticket held for discussion — those stay
          skipped until someone records what the meeting decided, on the feedback view.
        </p>
      </Section>

      <Section id="feedback" title="The feedback view" index={8}>
        <p>
          Once a round is finalised, every committee member can open its feedback view: how each ticket scored —
          committee average, spread, and outcome — with nobody's individual score attributed to them.
        </p>
        <p>
          The one exception is your own data: the feedback view shows your own score next to the committee's for
          every ticket you scored, and a summary of whether you tended to score above or below the room. That's
          shown here, after the round, rather than during it — seeing the room's answer before giving your own
          wouldn't be an independent score.
        </p>
        <p>
          For a ticket held for discussion, a coordinator can record what the meeting decided directly on its card
          here — a short outcome, an optional note, and an agreed score if the meeting settled on one. Once
          recorded, that outcome is visible to the whole committee, and if an agreed score was given, the ticket
          becomes eligible for the normal JIRA write-back like any other — no separate step to remember.
        </p>
      </Section>
    </>
  );
}

function Section({
  id,
  title,
  index,
  defaultOpen,
  children,
}: {
  id: string;
  title: string;
  index: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="card guide-section" id={id} open={defaultOpen}>
      <summary aria-labelledby={`${id}-h`}>
        <span className="guide-section-index">{index}</span>
        <h2 id={`${id}-h`}>{title}</h2>
      </summary>
      <div className="guide-section-body">{children}</div>
    </details>
  );
}
