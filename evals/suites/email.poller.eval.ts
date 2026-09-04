import { describe, expect, it } from "vitest";
import { startWorker } from "@station/runtime";
import { scoringTurnCallsCommitSend } from "@station/loop";

const MASTER = "local-dev-master-key-32-bytes!!!!";

describe("email.poller (gate: merge)", () => {
  it("live producer parks the mailbox that owns the connection", async () => {
    const token = "poller-eval-token";
    const runtime = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
      env: {
        STATION_DATABASE_URL: "memory://t17-eval",
        STATION_MASTER_KEY: MASTER,
        STATION_POLL_MS: "20",
      },
    });
    try {
      const created = await fetch(`http://127.0.0.1:${runtime.workerPort}/connections`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          kind: "email",
          imapHost: "imap.example.com",
          imapUser: "eval-poll@acme.com",
          imapPass: "secret-imap",
          smtpHost: "smtp.example.com",
          smtpUser: "eval-poll@acme.com",
          smtpPass: "secret-smtp",
        }),
      });
      expect(created.status).toBe(200);
      const id = ((await created.json()) as { id: string }).id;
      await fetch(`http://127.0.0.1:${runtime.workerPort}/connections/${id}/test`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const started = await runtime.station.worker.startLiveProducers("eval-w");
      expect(started.started).toBeGreaterThanOrEqual(1);
      const park = await fetch(`http://127.0.0.1:${runtime.workerPort}/park`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = (await park.json()) as { items: Array<{ accountId?: string }> };
      expect(json.items.some((row) => row.accountId === "eval-poll@acme.com")).toBe(true);
      expect(scoringTurnCallsCommitSend()).toBe(false);
    } finally {
      await runtime.close();
    }
  });
});
