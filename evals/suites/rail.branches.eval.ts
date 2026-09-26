import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

describe("rail.branches (gate: merge)", () => {
  it("booked, objection, and silence each park and none of them send", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "eval-branch",
      tenantId: "tenant-a",
      mailboxId: "box-eval-branch",
      threadId: "thread-eval-branch",
      body: "Intro is out.",
    });
    await station.send.approve(parked.decisionId);
    const booked = await station.kit.resumeReply({
      mailboxId: "box-eval-branch",
      threadId: "thread-eval-branch",
      body: "We booked Thursday.",
    });
    expect(await station.send.decisionState(booked.decisionId)).toBe("parked");
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
    const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
    const slip = (listed.json as { items: Array<{ id: string; goalStage?: string }> }).items.find(
      (item) => item.id === booked.decisionId,
    );
    expect(slip?.goalStage).toBe("booked");

    const objecting = getStation({ seed: false });
    const held = await objecting.kit.parkInbound({
      id: "eval-objection",
      tenantId: "tenant-a",
      mailboxId: "box-eval-objection",
      threadId: "thread-eval-objection",
      body: "Intro is out.",
    });
    await objecting.send.approve(held.decisionId);
    const objection = await objecting.kit.resumeReply({
      mailboxId: "box-eval-objection",
      threadId: "thread-eval-objection",
      body: "Too expensive for us.",
    });
    expect(await objecting.send.decisionState(objection.decisionId)).toBe("parked");
    expect(await objecting.send.providerCallCount(held.sendId)).toBe(1);

    const quiet = getStation({ seed: false });
    const waiting = await quiet.kit.parkInbound({
      id: "eval-silence",
      tenantId: "tenant-a",
      mailboxId: "box-eval-silence",
      threadId: "thread-eval-silence",
      body: "Still waiting.",
    });
    await quiet.send.approve(waiting.decisionId);
    await quiet.kit.insertTimer({
      runId: waiting.runId,
      tenantId: "tenant-a",
      mailboxId: "box-eval-silence",
      threadId: "thread-eval-silence",
      wakeAt: "2000-01-01T00:00:00.000Z",
    });
    const woken = await quiet.kit.wakeDueTimers("2000-01-01T00:00:01.000Z");
    expect(await quiet.send.decisionState(woken.decisionId)).toBe("parked");
    expect(await quiet.send.providerCallCount(waiting.sendId)).toBe(1);
  });
});
