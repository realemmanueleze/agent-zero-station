import { describe, expect, it } from "vitest";
import { RailEngine } from "@station/loop";

describe("rail.checkpoint (gate: merge)", () => {
  it("a fixture inbound pauses with a draft and does not send", async () => {
    const sends: string[] = [];
    const rail = new RailEngine({
      send: (state) => sends.push(state.draft),
    });
    const parked = await rail.start({
      runId: "eval-rail",
      mailboxId: "work@unseen.test",
      threadId: "thread-eval",
      thread: "Need a consult this week.",
      from: "jordan@northwind.io",
      subject: "Consult",
    });
    expect(parked.phase).toBe("human_review");
    expect(parked.draft.length).toBeGreaterThan(0);
    expect(sends).toEqual([]);
    expect(rail.checkpointer.constructor.name).toBe("LedgerCheckpointer");
  });
});
