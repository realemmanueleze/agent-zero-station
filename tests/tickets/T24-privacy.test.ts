import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { PRIVACY_HREF, renderPrivacyHtml } from "../../apps/cockpit/src/ui/privacy.ts";

const LEAK = ["STATION_MASTER_KEY", "STATION_CONTROL_TOKEN", "refreshToken", "Bearer ", "imapPass"];

describe("T24 privacy", () => {
  it("PRIVACY.md says self-hosted", () => {
    const text = readFileSync(join(process.cwd(), "docs/PRIVACY.md"), "utf8");
    expect(existsSync(join(process.cwd(), "docs/PRIVACY.md"))).toBe(true);
    expect(text).toMatch(/self-hosted|clone and host/i);
    expect(text).toMatch(/\/privacy/);
  });

  it("privacy HTML has no secrets", () => {
    const html = renderPrivacyHtml();
    expect(html).toMatch(/self-hosted/i);
    for (const leak of LEAK) {
      expect(html).not.toContain(leak);
    }
  });

  it("cockpit shell links to /privacy", () => {
    const shell = readFileSync(join(process.cwd(), "apps/cockpit/src/ui/StationShell.tsx"), "utf8");
    expect(PRIVACY_HREF).toBe("/privacy");
    expect(shell).toMatch(/PRIVACY_HREF/);
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
