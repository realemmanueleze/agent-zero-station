import { mkdtempSync, existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { renderProposal, writeProposal } from "../../packages/station/src/learning.ts";

describe("T22 learning", () => {
  it("renderProposal lists outcomes and forbids auto-merge", () => {
    const md = renderProposal("2026-09-04", "sales", [
      { kind: "sent", note: "quote approved" },
      { kind: "killed", note: "wrong tone" },
    ]);
    expect(md).toMatch(/quote approved/);
    expect(md).toMatch(/wrong tone/);
    expect(md).toMatch(/never auto-merges/);
    expect(md).not.toMatch(/apply automatically/i);
  });

  it("writeProposal writes packs/sales/proposals/date.md only", () => {
    const root = mkdtempSync(join(tmpdir(), "t22-learn-"));
    mkdirSync(join(root, "packs", "sales"), { recursive: true });
    writeFileSync(join(root, "packs", "sales", "directives.md"), "keep me\n");
    const before = readFileSync(join(root, "packs", "sales", "directives.md"), "utf8");
    const result = writeProposal({
      packId: "sales",
      date: "2026-09-04",
      outcomes: [{ kind: "sent", note: "ok" }],
      root,
    });
    expect(result.wroteDirectives).toBe(false);
    expect(result.path).toMatch(/packs\/sales\/proposals\/2026-09-04\.md$/);
    expect(existsSync(result.path)).toBe(true);
    expect(readFileSync(join(root, "packs", "sales", "directives.md"), "utf8")).toBe(before);
  });

  it("empty outcomes still write a fail-closed file", () => {
    const root = mkdtempSync(join(tmpdir(), "t22-empty-"));
    const result = writeProposal({ packId: "sales", date: "2026-09-05", outcomes: [], root });
    expect(readFileSync(result.path, "utf8")).toMatch(/No outcomes today/);
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
