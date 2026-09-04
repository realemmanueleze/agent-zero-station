import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { scoringTurnCallsCommitSend } from "@station/loop";

const MASTER = "local-dev-master-key-32-bytes!!!!";

async function pasteLive(
  port: number,
  account: string,
): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${port}/connections`, {
    method: "POST",
    headers: { authorization: "Bearer t17", "content-type": "application/json" },
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
    headers: { authorization: "Bearer t17" },
  });
  expect(tested.status).toBe(200);
}

describe("T17 email poller", () => {
  it("startLiveProducers parks inbound for a live mailbox account", async () => {
    const station = getStation({ seed: false });
    station.config.load({
      STATION_DATABASE_URL: "memory://t17-park",
      STATION_MASTER_KEY: MASTER,
      STATION_POLL_MS: "20",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t17" });
    try {
      await pasteLive(bound.port, "poll@acme.com");
      const result = await station.worker.startLiveProducers("w1");
      expect(result.started).toBe(1);
      const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
      const items = (listed.json as { items: Array<{ accountId?: string; state: string }> }).items;
      expect(items.some((row) => row.accountId === "poll@acme.com" && row.state === "parked")).toBe(
        true,
      );
    } finally {
      await bound.close();
    }
  });

  it("second tick increments producerTickCount", async () => {
    const station = getStation({ seed: false });
    station.config.load({
      STATION_DATABASE_URL: "memory://t17-ticks",
      STATION_MASTER_KEY: MASTER,
      STATION_POLL_MS: "15",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t17" });
    try {
      await pasteLive(bound.port, "tick@acme.com");
      await station.worker.startLiveProducers("w1");
      expect(await station.worker.producerTickCount("email:tick@acme.com")).toBeGreaterThanOrEqual(1);
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(await station.worker.producerTickCount("email:tick@acme.com")).toBeGreaterThanOrEqual(2);
    } finally {
      await bound.close();
    }
  });

  it("26th live mailbox is skipped", async () => {
    const station = getStation({ seed: false });
    station.config.load({
      STATION_DATABASE_URL: "memory://t17-cap",
      STATION_MASTER_KEY: MASTER,
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t17" });
    try {
      for (let i = 0; i < 26; i += 1) {
        await pasteLive(bound.port, `box${i}@acme.com`);
      }
      const result = await station.worker.startLiveProducers("w1");
      expect(result.started).toBe(25);
      expect(result.skipped).toBe(1);
    } finally {
      await bound.close();
    }
  });

  it("a throwing mailbox does not stop the next one", async () => {
    const station = getStation({ seed: false });
    station.config.load({
      STATION_DATABASE_URL: "memory://t17-iso",
      STATION_MASTER_KEY: MASTER,
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t17" });
    try {
      await pasteLive(bound.port, "boom@acme.com");
      await pasteLive(bound.port, "ok@acme.com");
      const result = await station.worker.startLiveProducers("w1");
      expect(result.started).toBeGreaterThanOrEqual(1);
      const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
      const items = (listed.json as { items: Array<{ accountId?: string }> }).items;
      expect(items.some((row) => row.accountId === "ok@acme.com")).toBe(true);
    } finally {
      await bound.close();
    }
  });

  it("same producer ref starts once", async () => {
    const station = getStation({ seed: false });
    station.config.load({
      STATION_DATABASE_URL: "memory://t17-once",
      STATION_MASTER_KEY: MASTER,
    });
    await Promise.allSettled([
      station.worker.startProducer("email:once@acme.com", "w1"),
      station.worker.startProducer("email:once@acme.com", "w2"),
    ]);
    expect(await station.worker.producerStartCount("email:once@acme.com")).toBe(1);
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
