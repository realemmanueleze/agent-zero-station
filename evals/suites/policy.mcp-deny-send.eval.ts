import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";

const station = getStation();

describe("policy.mcp-deny-send (gate: merge)", () => {
  it("fake MCP tool gmail_send is denied on the live tool list", () => {
    expect(station.config.mcpAllowed("gmail_send")).toBe(false);
  });
});
