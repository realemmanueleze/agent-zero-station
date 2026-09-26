import { describe, expect, it } from "vitest";
import { buildLivePrompt } from "@station/loop";

describe("context.must-not-leak (gate: merge)", () => {
  it("tenant A’s prompt has none of tenant B", () => {
    const prompt = buildLivePrompt({
      tenantId: "tenant-a",
      recordId: "rec-1",
      signal: { fixtureId: "eval", tenantId: "tenant-a", text: "alpha" },
      ledgerHits: [
        { tenantId: "tenant-a", text: "alpha-hit" },
        { tenantId: "tenant-b", text: "bravo-secret" },
      ],
      examples: [
        { tenantId: "tenant-a", recordId: "rec-1", text: "alpha-example" },
        { tenantId: "tenant-b", recordId: "rec-9", text: "bravo-example-secret" },
      ],
    });
    expect(prompt).toContain("alpha-hit");
    expect(prompt).toContain("alpha-example");
    expect(prompt).not.toContain("bravo-secret");
    expect(prompt).not.toContain("bravo-example-secret");
  });
});
