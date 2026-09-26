-- Outbox, reply waits, and tenant context. Applied with the other ledger migrations.

CREATE TABLE IF NOT EXISTS outbox (
  send_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  receipt TEXT,
  provider_thread_id TEXT
);

CREATE INDEX IF NOT EXISTS outbox_queued ON outbox (state) WHERE state = 'queued';

CREATE TABLE IF NOT EXISTS waits (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  wake_at TIMESTAMPTZ,
  state TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS waits_one_open_reply
  ON waits (mailbox_id, thread_id)
  WHERE state = 'open' AND reason = 'reply';

CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  body TEXT NOT NULL
);

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS mailbox_id TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS producer_ref TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS killed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS kill_phase TEXT;
