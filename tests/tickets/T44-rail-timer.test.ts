import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

type Slip = {
  id: string;
  state: string;
  phase?: string | null;
  trace?: string[];
  body?: string;
  runId?: string | null;
};

describe("T44 rail timer", () => {
  it("a due timer parks a follow-up and does not send", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "t44-timer",
      tenantId: "tenant-a",
      mailboxId: "box-t44",
      threadId: "thread-t44-timer",
      body: "Intro is out.",
    });
    await station.send.approve(parked.decisionId);
    await station.kit.insertTimer({
      runId: parked.runId,
      tenantId: "tenant-a",
      mailboxId: "box-t44",
      threadId: "thread-t44-timer",
      wakeAt: "2000-01-01T00:00:00.000Z",
    });
    const woken = await station.kit.wakeDueTimers("2000-01-01T00:00:01.000Z");
    expect(woken.runId).toBe(parked.runId);
    expect(await station.send.decisionState(woken.decisionId)).toBe("parked");
    expect(await station.kit.outbox(woken.decisionId)).toBeNull();
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
    const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
    const slip = (listed.json as { items: Slip[] }).items.find((item) => item.id === woken.decisionId);
    expect(slip?.phase).toBe("human_review");
    expect(slip?.trace).toContain("draft_follow_up");
    expect(slip?.body).not.toBe("timer draft");
  });

  it("a reply marks the open timer dead", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "t44-reply",
      tenantId: "tenant-a",
      mailboxId: "box-t44",
      threadId: "thread-t44-reply",
      body: "Waiting.",
    });
    await station.send.approve(parked.decisionId);
    await station.kit.insertTimer({
      runId: parked.runId,
      tenantId: "tenant-a",
      mailboxId: "box-t44",
      threadId: "thread-t44-reply",
      wakeAt: "2999-01-01T00:00:00.000Z",
    });
    await station.kit.resumeReply({
      mailboxId: "box-t44",
      threadId: "thread-t44-reply",
      body: "Here is the reply.",
    });
    expect(await station.kit.waits(parked.runId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: "timer", state: "dead" })]),
    );
  });

  it("approve does not create a timer unless one is inserted", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "t44-quiet",
      tenantId: "tenant-a",
      mailboxId: "box-t44",
      threadId: "thread-t44-quiet",
      body: "No schedule.",
    });
    await station.send.approve(parked.decisionId);
    const timers = (await station.kit.waits(parked.runId)).filter((row) => row.reason === "timer");
    expect(timers).toEqual([]);
  });

  it("the mail poll wakes a due timer", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "t44-poll",
      tenantId: "tenant-a",
      mailboxId: "box-t44",
      threadId: "thread-t44-poll",
      body: "Poll should wake this.",
    });
    await station.send.approve(parked.decisionId);
    await station.kit.insertTimer({
      runId: parked.runId,
      tenantId: "tenant-a",
      mailboxId: "box-t44",
      threadId: "thread-t44-poll",
      wakeAt: "2000-01-01T00:00:00.000Z",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t44" });
    try {
      await station.worker.startProducer("email:t44@acme.com", "w1");
      const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
      const followUp = (listed.json as { items: Slip[] }).items.find(
        (item) => item.runId === parked.runId && item.state === "parked",
      );
      expect(followUp?.phase).toBe("human_review");
      expect(followUp?.trace).toContain("draft_follow_up");
      expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
    } finally {
      await bound.close();
    }
  });
});
