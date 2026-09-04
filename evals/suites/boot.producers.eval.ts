import { describe, expect, it } from "vitest";
import { startWorker } from "@station/runtime";
import { scoringTurnCallsCommitSend } from "@station/loop";

const MASTER = "local-dev-master-key-32-bytes!!!!";

describe("boot.producers (gate: merge)", () => {
  it("restarted worker parks the live mailbox; model never sends", async () => {
    const token = "boot-eval";
    const catalog = "memory://t25-eval";
    const first = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
      env: { STATION_DATABASE_URL: catalog, STATION_MASTER_KEY: MASTER },
    });
    try {
      const created = await fetch(`http://127.0.0.1:${first.workerPort}/connections`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          kind: "email",
          imapHost: "imap.example.com",
          imapUser: "eval-boot@acme.com",
          imapPass: "secret-imap",
          smtpHost: "smtp.example.com",
          smtpUser: "eval-boot@acme.com",
          smtpPass: "secret-smtp",
        }),
      });
      const id = ((await created.json()) as { id: string }).id;
      await fetch(`http://127.0.0.1:${first.workerPort}/connections/${id}/test`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } finally {
      await first.close();
    }

    const second = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
      env: { STATION_DATABASE_URL: catalog, STATION_MASTER_KEY: MASTER },
    });
    try {
      const park = await fetch(`http://127.0.0.1:${second.workerPort}/park`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = (await park.json()) as { items: Array<{ accountId?: string }> };
      expect(json.items.some((row) => row.accountId === "eval-boot@acme.com")).toBe(true);
      expect(scoringTurnCallsCommitSend()).toBe(false);
    } finally {
      await second.close();
    }
  });
});
