import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("send.must-not-autonomous (gate: merge)", () => {
  it("scoring turn never calls commitSend", async () => {
    expect(await station.send.scoringTurnCallsCommitSend()).toBe(false);
  });
});
