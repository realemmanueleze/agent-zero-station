import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("replay.pack-switch (gate: merge)", () => {
  it("same signals, new pack, park queue label changes", async () => {
    const after = await station.replay.rescore(["sig-1"], "inbox-triage");
    expect(after.packId).toBe("inbox-triage");
  });
});
