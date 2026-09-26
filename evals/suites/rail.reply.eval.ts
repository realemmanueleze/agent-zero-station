import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

describe("rail.reply (gate: merge)", () => {
  it("one send, then a reply parks the next draft on the same run", async () => {
    const station = getStation({ seed: false });
    const parked = await station.kit.parkInbound({
      id: "eval-reply",
      tenantId: "tenant-a",
      mailboxId: "box-eval-reply",
      threadId: "thread-eval-reply",
      body: "Send the intro.",
    });
    await station.send.approve(parked.decisionId);
    const next = await station.kit.resumeReply({
      mailboxId: "box-eval-reply",
      threadId: "thread-eval-reply",
      body: "Sounds good.",
    });
    expect(next.runId).toBe(parked.runId);
    expect(await station.send.decisionState(next.decisionId)).toBe("parked");
    expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
  });
});
