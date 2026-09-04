import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("T5 config", () => {
  it("same station and pack database URLs is config.pack_db_same_as_station", () => {
    expect(() =>
      station.config.load({
        STATION_DATABASE_URL: "postgres://station/db",
        PACK_DATABASE_URL: "postgres://station/db",
      }),
    ).toThrow(
      expect.objectContaining({ code: "config.pack_db_same_as_station" }),
    );
  });

  it("missing STATION_MASTER_KEY in non-test env is config.missing_master_key", () => {
    expect(() =>
      station.config.load({
        NODE_ENV: "production",
        STATION_DATABASE_URL: "postgres://station/db",
      }),
    ).toThrow(expect.objectContaining({ code: "config.missing_master_key" }));
  });

  it("default policy denies MCP tools matching send|mail|post|write", () => {
    expect(station.config.mcpAllowed("gmail_send")).toBe(false);
    expect(station.config.mcpAllowed("slack_post")).toBe(false);
    expect(station.config.mcpAllowed("obsidian_write")).toBe(false);
  });

  it("policy can allow a named tool; default-deny still holds for others", () => {
    expect(station.config.mcpAllowed("search_docs", { allow: ["search_docs"] })).toBe(
      true,
    );
    expect(station.config.mcpAllowed("gmail_send", { allow: ["search_docs"] })).toBe(
      false,
    );
  });

  it(".env.example lists every key read by config", () => {
    const read = station.config.readKeys();
    const example = station.config.envExampleKeys();
    expect(read.every((key) => example.includes(key))).toBe(true);
  });

  it("secrets in config dumps are redacted", () => {
    const dumped = station.config.dump({
      STATION_MASTER_KEY: "super-secret",
      STATION_CONTROL_TOKEN: "control-secret",
      STATION_COCKPIT_PASSWORD: "cockpit-secret",
    });
    const text = JSON.stringify(dumped);
    expect(text).not.toContain("super-secret");
    expect(text).not.toContain("control-secret");
    expect(text).not.toContain("cockpit-secret");
    expect(text).toMatch(/\[REDACTED\]/);
  });
});
