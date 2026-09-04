import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";

describe("T23 dist", () => {
  it("fly.toml names the cockpit port", () => {
    const text = readFileSync(join(process.cwd(), "fly.toml"), "utf8");
    expect(text).toMatch(/19173/);
    expect(text).toMatch(/STATION_COCKPIT_PORT|internal_port/);
  });

  it("release workflow publishes to GHCR on tag", () => {
    const text = readFileSync(join(process.cwd(), ".github/workflows/release.yml"), "utf8");
    expect(text).toMatch(/ghcr\.io/);
    expect(text).toMatch(/tags:/);
    expect(existsSync(join(process.cwd(), ".github/workflows/release.yml"))).toBe(true);
  });

  it("DEPLOY.md mentions Fly and GHCR", () => {
    const text = readFileSync(join(process.cwd(), "docs/DEPLOY.md"), "utf8");
    expect(text).toMatch(/Fly/i);
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
