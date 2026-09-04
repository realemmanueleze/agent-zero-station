import { StationError } from "@station/observability";
import type { ConnectionRow } from "./connections.ts";
import type { LedgerDecision, SharedLedger } from "./ledger.ts";
import { shouldApplyLedgerSql } from "./postgres.ts";

type PgClient = {
  connect: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

async function withClient<T>(url: string, fn: (client: PgClient) => Promise<T>): Promise<T> {
  if (!shouldApplyLedgerSql(url)) {
    return undefined as T;
  }
  try {
    const pg = (await import("pg")) as {
      default?: { Client: new (opts: { connectionString: string }) => PgClient };
      Client: new (opts: { connectionString: string }) => PgClient;
    };
    const Client = pg.Client ?? pg.default?.Client;
    if (!Client) {
      throw new Error("pg Client missing");
    }
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  } catch (err) {
    if (err instanceof StationError) {
      throw err;
    }
    throw new StationError({
      code: "schema.migrate_failed",
      message: "ledger persist failed",
      cause: err,
    });
  }
}

export async function hydrateLedgerFromSql(url: string, ledger: SharedLedger): Promise<void> {
  if (!shouldApplyLedgerSql(url)) {
    return;
  }
  if (ledger.connections.size > 0 || ledger.decisions.size > 0) {
    return;
  }
  await withClient(url, async (client) => {
    const connections = await client.query(
      "SELECT id, tenant_id, kind, account, label, status, key_id, nonce, tag, ciphertext, created_at, updated_at FROM connections",
    );
    for (const row of connections.rows) {
      const id = String(row.id);
      ledger.connections.set(id, {
        id,
        tenantId: String(row.tenant_id),
        kind: row.kind as ConnectionRow["kind"],
        account: String(row.account),
        label: String(row.label ?? row.account),
        status: row.status as ConnectionRow["status"],
        keyId: String(row.key_id),
        envelope: {
          nonce: Buffer.from(row.nonce as Uint8Array),
          tag: Buffer.from(row.tag as Uint8Array),
          ciphertext: Buffer.from(row.ciphertext as Uint8Array),
        },
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
      });
    }
    const decisions = await client.query(
      "SELECT id, signal_id, pack_id, send_id, state, body, tenant_id, account, kind, send_to FROM decisions",
    );
    for (const row of decisions.rows) {
      const id = String(row.id);
      const sendId = String(row.send_id ?? `send-${id}`);
      ledger.decisions.set(id, {
        id,
        sendId,
        state: row.state as LedgerDecision["state"],
        body: String(row.body ?? ""),
        tenantId: String(row.tenant_id ?? "tenant-a"),
        packId: String(row.pack_id ?? "sales"),
        signalId: row.signal_id ? String(row.signal_id) : undefined,
        account: row.account ? String(row.account) : undefined,
        kind: row.kind as LedgerDecision["kind"],
        sendTo: row.send_to ? String(row.send_to) : undefined,
      });
      ledger.sendIds.add(sendId);
    }
  });
}

export async function flushLedgerToSql(url: string, ledger: SharedLedger): Promise<void> {
  if (!shouldApplyLedgerSql(url)) {
    return;
  }
  await withClient(url, async (client) => {
    for (const row of ledger.connections.values()) {
      await client.query(
        `INSERT INTO connections (id, tenant_id, kind, account, label, status, key_id, nonce, tag, ciphertext, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           key_id = EXCLUDED.key_id,
           nonce = EXCLUDED.nonce,
           tag = EXCLUDED.tag,
           ciphertext = EXCLUDED.ciphertext,
           label = EXCLUDED.label,
           updated_at = EXCLUDED.updated_at`,
        [
          row.id,
          row.tenantId,
          row.kind,
          row.account,
          row.label,
          row.status,
          row.keyId,
          row.envelope.nonce,
          row.envelope.tag,
          row.envelope.ciphertext,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }
    for (const row of ledger.decisions.values()) {
      await client.query(
        `INSERT INTO decisions (id, signal_id, pack_id, send_id, state, body, tenant_id, account, kind, send_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           state = EXCLUDED.state,
           body = EXCLUDED.body,
           account = EXCLUDED.account,
           kind = EXCLUDED.kind,
           send_to = EXCLUDED.send_to,
           pack_id = EXCLUDED.pack_id`,
        [
          row.id,
          row.signalId ?? null,
          row.packId,
          row.sendId,
          row.state,
          row.body,
          row.tenantId,
          row.account ?? null,
          row.kind ?? null,
          row.sendTo ?? null,
        ],
      );
    }
  });
}
