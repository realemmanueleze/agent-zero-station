import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

describe("rail.timer (gate: merge)", () => {
  it("a due timer parks a follow-up and nothing is sent", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "eval-timer",
      tenantId: "tenant-a",
      mailboxId: "box-eval-timer",
      threadId: "thread-eval-timer",
      body: "Sent the intro.",
    });
    await station.send.approve(parked.decisionId);
    await station.kit.insertTimer({
      runId: parked.runId,
      tenantId: "tenant-a",
      mailboxId: "box-eval-timer",
      threadId: "thread-eval-timer",
      wakeAt: "2000-01-01T00:00:00.000Z",
    });
    const woken = await station.kit.wakeDueTimers("2000-01-01T00:00:01.000Z");
    expect(woken.runId).toBe(parked.runId);
    expect(await station.send.decisionState(woken.decisionId)).toBe("parked");
    expect(await station.kit.outbox(woken.decisionId)).toBeNull();
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });
});
