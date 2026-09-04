-- Encrypted connections vault + decision mailbox binding.

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  account TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL,
  key_id TEXT NOT NULL,
  nonce BYTEA NOT NULL,
  tag BYTEA NOT NULL,
  ciphertext BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, account)
);

CREATE INDEX IF NOT EXISTS connections_tenant_kind ON connections (tenant_id, kind);

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS account TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS send_to TEXT;
