import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";

describe("dist.release (gate: merge)", () => {
  it("ship files exist; model never sends", () => {
    expect(existsSync("fly.toml")).toBe(true);
    expect(existsSync(".github/workflows/release.yml")).toBe(true);
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
