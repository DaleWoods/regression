-- §9: how long (ms) a member's scoring form was open before their most
-- recent save, captured client-side from when the ticket card mounted.
-- Purely a rubber-stamp signal for the coordinator - never blocks a
-- submission, and null for anything saved before this column existed.
ALTER TABLE submissions ADD COLUMN duration_ms INTEGER;
