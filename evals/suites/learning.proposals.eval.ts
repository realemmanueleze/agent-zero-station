import { mkdtempSync, existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { writeProposal } from "../../packages/station/src/learning.ts";

describe("learning.proposals (gate: merge)", () => {
  it("proposal file exists; directives stay put", () => {
    const root = mkdtempSync(join(tmpdir(), "t22-eval-"));
    mkdirSync(join(root, "packs", "sales"), { recursive: true });
    writeFileSync(join(root, "packs", "sales", "directives.md"), "human owned\n");
    const result = writeProposal({
      packId: "sales",
      date: "2026-09-04",
      outcomes: [{ kind: "human_label", note: "too salesy" }],
      root,
    });
    expect(existsSync(result.path)).toBe(true);
    expect(readFileSync(join(root, "packs", "sales", "directives.md"), "utf8")).toBe("human owned\n");
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
