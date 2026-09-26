import { StationError } from "@station/observability";
import type { ConnectionRow } from "./connections.ts";
import type { KitOutbox, KitWait } from "./kit-ledger.ts";
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
      "SELECT id, signal_id, pack_id, send_id, state, body, tenant_id, account, kind, send_to, run_id, mailbox_id, thread_id, producer_ref, killed, kill_phase FROM decisions",
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
        runId: row.run_id ? String(row.run_id) : undefined,
        mailboxId: row.mailbox_id ? String(row.mailbox_id) : undefined,
        threadId: row.thread_id ? String(row.thread_id) : undefined,
        producerRef: row.producer_ref ? String(row.producer_ref) : undefined,
        killed: row.killed === true,
        killPhase: row.kill_phase ? (String(row.kill_phase) as LedgerDecision["killPhase"]) : undefined,
      });
      ledger.sendIds.add(sendId);
    }
    const outbox = await client.query(
      "SELECT send_id, run_id, decision_id, state, attempts, receipt, provider_thread_id FROM outbox",
    );
    for (const row of outbox.rows) {
      const sendId = String(row.send_id);
      ledger.outbox.set(sendId, {
        sendId,
        runId: String(row.run_id),
        decisionId: String(row.decision_id),
        state: String(row.state) as KitOutbox["state"],
        attempts: Number(row.attempts ?? 0),
        receipt: row.receipt ? String(row.receipt) : null,
        providerThreadId: row.provider_thread_id ? String(row.provider_thread_id) : null,
      });
    }
    const waits = await client.query(
      "SELECT id, run_id, tenant_id, mailbox_id, thread_id, reason, wake_at, state FROM waits",
    );
    ledger.waits.splice(0, ledger.waits.length);
    for (const row of waits.rows) {
      ledger.waits.push({
        id: String(row.id),
        runId: String(row.run_id),
        tenantId: String(row.tenant_id),
        mailboxId: String(row.mailbox_id),
        threadId: String(row.thread_id),
        reason: String(row.reason) as KitWait["reason"],
        wakeAt: row.wake_at ? new Date(String(row.wake_at)).toISOString() : null,
        state: String(row.state) as KitWait["state"],
      });
    }
    const records = await client.query("SELECT id, tenant_id, body, kind, actor FROM records");
    ledger.records.splice(0, ledger.records.length);
    for (const row of records.rows) {
      const kind = String(row.kind ?? "");
      if (kind !== "lead" && kind !== "traveler" && kind !== "job" && kind !== "client") {
        continue;
      }
      ledger.records.push({
        id: String(row.id),
        tenantId: String(row.tenant_id),
        body: String(row.body ?? ""),
        kind,
        actor: String(row.actor ?? ""),
      });
    }
  });
}

export function daCheckpointQuery(row: { id: string; checkpoint: unknown }): {
  text: string;
  values: [string, string];
} {
  return {
    text: `INSERT INTO da_checkpoints (id, checkpoint) VALUES ($1, $2::jsonb)
      ON CONFLICT (id) DO UPDATE SET checkpoint = EXCLUDED.checkpoint`,
    values: [row.id, JSON.stringify(row.checkpoint)],
  };
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
        `INSERT INTO decisions (id, signal_id, pack_id, send_id, state, body, tenant_id, account, kind, send_to, run_id, mailbox_id, thread_id, producer_ref, killed, kill_phase)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO UPDATE SET
           state = EXCLUDED.state,
           body = EXCLUDED.body,
           account = EXCLUDED.account,
           kind = EXCLUDED.kind,
           send_to = EXCLUDED.send_to,
           pack_id = EXCLUDED.pack_id,
           run_id = EXCLUDED.run_id,
           mailbox_id = EXCLUDED.mailbox_id,
           thread_id = EXCLUDED.thread_id,
           producer_ref = EXCLUDED.producer_ref,
           killed = EXCLUDED.killed,
           kill_phase = EXCLUDED.kill_phase`,
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
          row.runId ?? null,
          row.mailboxId ?? null,
          row.threadId ?? null,
          row.producerRef ?? null,
          row.killed === true,
          row.killPhase ?? null,
        ],
      );
    }
    await replaceKit(client, ledger);
  });
}

async function replaceKit(
  client: PgClient,
  ledger: SharedLedger,
): Promise<void> {
  await client.query("DELETE FROM outbox");
  for (const row of ledger.outbox.values()) {
    await client.query(
      `INSERT INTO outbox (send_id, run_id, decision_id, state, attempts, receipt, provider_thread_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        row.sendId,
        row.runId,
        row.decisionId,
        row.state,
        row.attempts,
        row.receipt,
        row.providerThreadId,
      ],
    );
  }
  await client.query("DELETE FROM waits");
  for (const row of ledger.waits) {
    await client.query(
      `INSERT INTO waits (id, run_id, tenant_id, mailbox_id, thread_id, reason, wake_at, state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.runId, row.tenantId, row.mailboxId, row.threadId, row.reason, row.wakeAt, row.state],
    );
  }
  await client.query("DELETE FROM records");
  for (const row of ledger.records) {
    await client.query(
      `INSERT INTO records (id, tenant_id, body, kind, actor) VALUES ($1,$2,$3,$4,$5)`,
      [row.id, row.tenantId, row.body, row.kind, row.actor],
    );
  }
  for (const row of ledger.daCheckpoints ?? []) {
    const query = daCheckpointQuery(row);
    await client.query(query.text, query.values);
  }
}
