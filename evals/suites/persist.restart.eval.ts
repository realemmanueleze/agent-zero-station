import { describe, expect, it } from "vitest";
import { startWorker } from "@station/runtime";
import { scoringTurnCallsCommitSend } from "@station/loop";

const MASTER = "local-dev-master-key-32-bytes!!!!";
const CATALOG = "memory://t16-eval";

describe("persist.restart (gate: merge)", () => {
  it("paste survives a new worker on the same catalog; secrets stay out", async () => {
    const token = "persist-eval-token";
    const first = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
      env: { STATION_DATABASE_URL: CATALOG, STATION_MASTER_KEY: MASTER },
    });
    try {
      const created = await fetch(`http://127.0.0.1:${first.workerPort}/connections`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          kind: "email",
          imapHost: "imap.example.com",
          imapUser: "eval@acme.com",
          imapPass: "secret-imap",
          smtpHost: "smtp.example.com",
          smtpUser: "eval@acme.com",
          smtpPass: "secret-smtp",
        }),
      });
      expect(created.status).toBe(200);
    } finally {
      await first.close();
    }

    const second = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
      env: { STATION_DATABASE_URL: CATALOG, STATION_MASTER_KEY: MASTER },
    });
    try {
      const listed = await fetch(`http://127.0.0.1:${second.workerPort}/connections`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = (await listed.json()) as { items: Array<{ account: string }> };
      expect(json.items.some((row) => row.account === "eval@acme.com")).toBe(true);
      const raw = JSON.stringify(json);
      expect(raw).not.toContain("secret-imap");
      expect(raw).not.toContain("imapPass");
      expect(raw).not.toContain(MASTER);
      expect(scoringTurnCallsCommitSend()).toBe(false);
    } finally {
      await second.close();
    }
  });
});
