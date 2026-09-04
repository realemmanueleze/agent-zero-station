import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

describe("T13 ship kit", () => {
  it("LICENSE is MIT", () => {
    const license = readFileSync(join(process.cwd(), "LICENSE"), "utf8");
    expect(license).toMatch(/MIT License/);
  });

  it("contract, channel, and deploy docs exist", () => {
    expect(existsSync(join(process.cwd(), "docs/CONTRACT.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs/ADDING_A_CHANNEL.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs/DEPLOY.md"))).toBe(true);
  });

  it("Dockerfile and compose.yml exist", () => {
    expect(existsSync(join(process.cwd(), "Dockerfile"))).toBe(true);
    expect(existsSync(join(process.cwd(), "compose.yml"))).toBe(true);
  });

  it("compose smoke exits 0 when a parked fixture is present", async () => {
    const station = getStation({ seed: false });
    await station.schema.loadFixtureFile("fixtures/demo.jsonl");
    expect(await station.replay.composeSmokeExit()).toBe(0);
  });

  it(".env.example lists every config key", () => {
    const station = getStation();
    const read = station.config.readKeys();
    const example = station.config.envExampleKeys();
    expect(read.every((key) => example.includes(key))).toBe(true);
  });
});
