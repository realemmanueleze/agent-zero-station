import type { ConnectionRow } from "./connections.ts";

export type LedgerDecision = {
  id: string;
  sendId: string;
  state: "parked" | "sending" | "sent" | "dropped";
  body: string;
  tenantId: string;
  packId: string;
  signalId?: string;
  from?: string;
  subject?: string;
  amount?: number;
  rationale?: string;
  account?: string;
  kind?: "email" | "slack" | "obsidian" | "db" | "mcp";
  sendTo?: string;
};

export type LedgerSignal = {
  id: string;
  fixtureId: string;
  tenantId: string;
  text: string;
};

export type LedgerLease = {
  workerId: string;
  heartbeatAt: number;
};

export type SharedLedger = {
  connections: Map<string, ConnectionRow>;
  decisions: Map<string, LedgerDecision>;
  signals: Map<string, LedgerSignal>;
  claims: Map<string, string>;
  leases: Map<string, LedgerLease>;
  sendIds: Set<string>;
};

const ledgers = new Map<string, SharedLedger>();

export function catalogKey(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  if (url.includes("migrate-fail")) {
    return undefined;
  }
  if (url === "postgres://station/db" || url === "postgres://pack/db") {
    return undefined;
  }
  return url;
}

export function getSharedLedger(url: string | undefined): SharedLedger | undefined {
  const key = catalogKey(url);
  if (!key) {
    return undefined;
  }
  const existing = ledgers.get(key);
  if (existing) {
    return existing;
  }
  const created: SharedLedger = {
    connections: new Map(),
    decisions: new Map(),
    signals: new Map(),
    claims: new Map(),
    leases: new Map(),
    sendIds: new Set(),
  };
  ledgers.set(key, created);
  return created;
}
