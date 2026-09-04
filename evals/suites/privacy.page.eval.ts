import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { renderPrivacyHtml } from "../../apps/cockpit/src/ui/privacy.ts";

describe("privacy.page (gate: merge)", () => {
  it("public privacy copy; no control token; model never sends", () => {
    const html = renderPrivacyHtml();
    expect(html).toMatch(/Privacy/);
    expect(html).not.toContain("STATION_CONTROL_TOKEN");
    expect(html).not.toContain("Bearer ");
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
