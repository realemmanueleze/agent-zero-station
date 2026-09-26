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

  it("container cockpit binds all interfaces so published ports work", () => {
    const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/STATION_COCKPIT_HOST=0\.0\.0\.0/);
    const smoke = readFileSync(join(process.cwd(), "compose.smoke.yml"), "utf8");
    expect(smoke).toMatch(/STATION_COCKPIT_HOST:\s*"?0\.0\.0\.0"?/);
    expect(smoke).toMatch(/127\.0\.0\.1:29173:19173/);
    expect(smoke).not.toMatch(/0\.0\.0\.0:29173/);
    expect(smoke).toMatch(/postgres:16-alpine/);
    const compose = readFileSync(join(process.cwd(), "compose.yml"), "utf8");
    expect(compose).toMatch(/127\.0\.0\.1:19173:19173/);
    expect(compose).not.toMatch(/^\s+-\s+"19173:19173"/m);
  });

  it(".env.example lists every config key", () => {
    const station = getStation();
    const read = station.config.readKeys();
    const example = station.config.envExampleKeys();
    expect(read.every((key) => example.includes(key))).toBe(true);
  });
});
