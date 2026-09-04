import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { commitSend, createMemoryTransport } from "@station/channels";
import { scoringTurnCallsCommitSend } from "@station/loop";

describe("email.park-then-approve (gate: merge)", () => {
  it("fixture parks, Approve hits transport once, model never sends", async () => {
    const station = getStation();
    expect(await station.send.decisionState("dec-parked")).toBe("parked");
    const sent: Array<{ to: string }> = [];
    await commitSend(
      { to: "jordan@northwind.io", body: "quote" },
      createMemoryTransport({ sent }),
    );
    expect(sent).toHaveLength(1);
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
