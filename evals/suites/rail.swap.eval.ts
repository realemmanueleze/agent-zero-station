import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { fakeDraftModel } from "../../packages/loop/src/drafter.ts";

describe("rail.swap (gate: merge)", () => {
  it("both drafters park, send once, and resume the same run", async () => {
    for (const [id, model] of [
      ["eval-pack", undefined],
      ["eval-agent", fakeDraftModel()],
    ] as const) {
      const station = getStation({ seed: false });
      if (model) {
        await station.kit.armDrafter(model);
      }
      const parked = await station.kit.parkInbound({
        id,
        tenantId: "tenant-a",
        mailboxId: `box-${id}`,
        threadId: `thread-${id}`,
        body: "Hello",
      });
      const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
      const card = (listed.json as { items: Array<{ id: string; phase?: string | null }> }).items.find(
        (row) => row.id === id,
      );
      expect(card?.phase).toBe("human_review");
      await station.send.approve(id);
      expect(await station.send.providerCallCount(parked.sendId)).toBe(1);
      const resumed = await station.kit.resumeReply({
        mailboxId: `box-${id}`,
        threadId: `thread-${id}`,
        body: "Thanks",
      });
      expect(resumed.runId).toBe(parked.runId);
    }
  });
});
