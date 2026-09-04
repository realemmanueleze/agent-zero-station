-- Station ledger. Applied to STATION_DATABASE_URL only.
-- Checkpointer tables use the da_ prefix so they never collide with these names.

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  fixture_id TEXT UNIQUE,
  tenant_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  signal_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, pack_id)
);

CREATE TABLE IF NOT EXISTS leases (
  producer_ref TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  signal_id TEXT,
  pack_id TEXT,
  send_id TEXT UNIQUE,
  state TEXT NOT NULL,
  body TEXT,
  tenant_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS da_checkpoints (
  id TEXT PRIMARY KEY,
  checkpoint JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS da_writes (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);
