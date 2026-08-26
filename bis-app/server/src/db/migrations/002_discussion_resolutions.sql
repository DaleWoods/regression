-- §10.4: what a meeting decided about a ticket that was held for discussion
-- (spread too wide to average). Deliberately separate from ticket_results,
-- which is a snapshot that only ever gets deleted-and-reinserted as a whole -
-- a resolution recorded here must survive that.
CREATE TABLE IF NOT EXISTS discussion_resolutions (
  round_id      TEXT NOT NULL,
  ticket_id     TEXT NOT NULL,
  outcome       TEXT NOT NULL,             -- short free text, e.g. "Send for estimation"
  note          TEXT NOT NULL DEFAULT '',
  agreed_score  INTEGER,                   -- 0-70, set only when the meeting agreed a number to write to JIRA
  resolved_by   TEXT NOT NULL,
  resolved_at   TEXT NOT NULL,
  PRIMARY KEY (round_id, ticket_id),
  FOREIGN KEY (round_id) REFERENCES rounds (id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
);
