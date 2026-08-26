-- §11/§15: a log of what the cadence scheduler did, so a coordinator can see
-- why (or whether) an automated step ran, and so a failed step can be
-- retried exactly once instead of silently repeating forever.
CREATE TABLE IF NOT EXISTS automation_log (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,             -- DISTRIBUTE | REMIND | ESCALATE | CLOSE
  round_id   TEXT NOT NULL,
  status     TEXT NOT NULL,             -- SUCCESS | FAILED | SKIPPED
  -- The idempotency key for this (kind, round): '' for DISTRIBUTE/CLOSE,
  -- the hours-before-cutoff threshold for REMIND/ESCALATE. Never free text -
  -- that's what `note` is for - so a lookup by (kind, round_id, detail) is
  -- always an exact match.
  detail     TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  attempts   INTEGER NOT NULL DEFAULT 1,
  ran_at     TEXT NOT NULL,
  FOREIGN KEY (round_id) REFERENCES rounds (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_automation_log_round_kind ON automation_log (round_id, kind);
