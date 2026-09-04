import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import {
  executeLiveTools,
  runLiveTurn,
  runScoringTurn,
  scoringTurnCallsCommitSend,
} from "@station/loop";

const MASTER = "local-dev-master-key-32-bytes!!!!";

async function pasteLive(port: number, account: string): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${port}/connections`, {
    method: "POST",
    headers: { authorization: "Bearer t27", "content-type": "application/json" },
    body: JSON.stringify({
      kind: "email",
      imapHost: "imap.example.com",
      imapUser: account,
      imapPass: "secret-imap",
      smtpHost: "smtp.example.com",
      smtpUser: account,
      smtpPass: "secret-smtp",
    }),
  });
  expect(res.status).toBe(200);
  const id = ((await res.json()) as { id: string }).id;
  const tested = await fetch(`http://127.0.0.1:${port}/connections/${id}/test`, {
    method: "POST",
    headers: { authorization: "Bearer t27" },
  });
  expect(tested.status).toBe(200);
}

describe("T27 live tools on park", () => {
  it("executeLiveTools runs the table and never commit_send", () => {
    const traces = executeLiveTools({
      signal: { fixtureId: "t27", tenantId: "tenant-a", text: "need a quote", from: "lead@acme.com" },
      state: "parked",
      draft: "sales draft",
      adapters: {
        ledgerHits: [
          { tenantId: "tenant-a", text: "inbox for tenant-a" },
          { tenantId: "tenant-b", text: "tenant-b-secret-body" },
        ],
        queryDb: () => ({ rows: [] }),
        vaultSearch: () => ["notes/quote.md"],
      },
    });
    const names = traces.map((row) => row.name);
    expect(names).toContain("read_signal");
    expect(names).toContain("search_ledger");
    expect(names).toContain("query_db");
    expect(names).toContain("vault_search");
    expect(names).not.toContain("commit_send");
    const ledger = traces.find((row) => row.name === "search_ledger");
    expect(ledger?.detail).toContain("inbox for tenant-a");
    expect(ledger?.detail).not.toContain("tenant-b-secret-body");
  });

  it("drop state executes drop, not send", () => {
    const traces = executeLiveTools({
      signal: { fixtureId: "t27-drop", tenantId: "tenant-a", text: "newsletter" },
      state: "dropped",
      draft: "triage note",
    });
    expect(traces.some((row) => row.name === "drop")).toBe(true);
    expect(traces.some((row) => row.name === "commit_send")).toBe(false);
  });

  it("parkProduced runs runLiveTurn and parks the pack draft", async () => {
    const vault = mkdtempSync(join(tmpdir(), "t27-vault-"));
    writeFileSync(join(vault, "inbound.md"), "inbound note");
    const station = getStation({ seed: false });
    station.config.load({
      STATION_DATABASE_URL: "memory://t27-park",
      STATION_MASTER_KEY: MASTER,
      STATION_VAULT_ROOT: vault,
      PACK_DATABASE_URL: "postgres://pack/db",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t27" });
    try {
      await pasteLive(bound.port, "live@acme.com");
      await station.worker.startLiveProducers("w1");
      const traces = await station.worker.lastLiveTraces();
      const names = traces.map((row) => row.name);
      expect(names).toContain("read_signal");
      expect(names).toContain("search_ledger");
      expect(names).toContain("query_db");
      expect(names).toContain("vault_search");
      expect(names).not.toContain("commit_send");
      const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
      const items = (listed.json as { items: Array<{ accountId?: string; body?: string; state: string }> })
        .items;
      const parked = items.find((row) => row.accountId === "live@acme.com" && row.state === "parked");
      expect(parked?.body).toMatch(/sales draft/i);
      expect(parked?.body).not.toBe("inbound");
    } finally {
      await bound.close();
    }
  });

  it("runLiveTurn without a model key still equals recorded scoring", () => {
    const signal = {
      fixtureId: "t27-eq",
      tenantId: "tenant-a",
      from: "lead@acme.com",
      text: "need a quote",
    };
    const recorded = runScoringTurn("sales", signal);
    const live = runLiveTurn("sales", signal);
    expect(live.body).toBe(recorded.body);
    expect(live.state).toBe(recorded.state);
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
