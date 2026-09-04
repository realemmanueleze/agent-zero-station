import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { startWorker } from "@station/runtime";
import { scoringTurnCallsCommitSend } from "@station/loop";

const MASTER = "local-dev-master-key-32-bytes!!!!";

async function pasteLive(port: number, token: string, account: string): Promise<void> {
  const created = await fetch(`http://127.0.0.1:${port}/connections`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
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
  expect(created.status).toBe(200);
  const id = ((await created.json()) as { id: string }).id;
  const tested = await fetch(`http://127.0.0.1:${port}/connections/${id}/test`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(tested.status).toBe(200);
}

describe("T25 boot producers", () => {
  it("startWorker parks inbound for a live row already on the catalog", async () => {
    const catalog = "memory://t25-boot";
    const token = "t25";
    const first = await startWorker({
      controlToken: token,
      fixturePath: "fixtures/demo.jsonl",
      env: { STATION_DATABASE_URL: catalog, STATION_MASTER_KEY: MASTER },
    });
    try {
      await pasteLive(first.workerPort, token, "boot@acme.com");
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
      expect(json.items.some((row) => row.accountId === "boot@acme.com")).toBe(true);
    } finally {
      await second.close();
    }
  });

  it("startLiveProducers on the same station starts a ref once", async () => {
    const station = getStation({ seed: false });
    station.config.load({
      STATION_DATABASE_URL: "memory://t25-once",
      STATION_MASTER_KEY: MASTER,
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t25" });
    try {
      await pasteLive(bound.port, "t25", "once@acme.com");
      await station.worker.startLiveProducers("w1");
      await station.worker.startLiveProducers("w1");
      expect(await station.worker.producerStartCount("email:once@acme.com")).toBe(1);
    } finally {
      await bound.close();
    }
  });

  it("boot with no live rows still parks the demo fixture", async () => {
    const runtime = await startWorker({
      controlToken: "t25-fix",
      fixturePath: "fixtures/demo.jsonl",
      env: { STATION_DATABASE_URL: "memory://t25-fixture", STATION_MASTER_KEY: MASTER },
    });
    try {
      const park = await fetch(`http://127.0.0.1:${runtime.workerPort}/park`, {
        headers: { authorization: "Bearer t25-fix" },
      });
      const json = (await park.json()) as { items: Array<{ id: string; state: string }> };
      expect(json.items.some((row) => row.state === "parked")).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
