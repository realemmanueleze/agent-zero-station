import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import {
  mcpToolAllowed,
  queryPackSql,
  slackPostMessage,
  vaultSearch,
} from "@station/channels";

describe("T20 live adapters", () => {
  it("slack postMessage hides the token in the result", async () => {
    const token = "xoxb-secret-token";
    const result = await slackPostMessage(token, "C1", "hello", async () => ({
      status: 200,
      json: async () => ({ ok: true }),
    }));
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("vaultSearch finds a note and does not write", () => {
    const root = mkdtempSync(join(tmpdir(), "t20-vault-"));
    writeFileSync(join(root, "northwind.md"), "seats for northwind");
    const hits = vaultSearch(root, "northwind");
    expect(hits.some((path) => path.endsWith("northwind.md"))).toBe(true);
  });

  it("queryPackSql rejects station catalog and writes", () => {
    expect(() =>
      queryPackSql("postgres://station/db", "postgres://station/db", "select 1"),
    ).toThrow(expect.objectContaining({ code: "config.pack_db_same_as_station" }));
    expect(() =>
      queryPackSql("postgres://pack/db", "postgres://station/db", "INSERT INTO x VALUES (1)"),
    ).toThrow(expect.objectContaining({ code: "connections.invalid" }));
    expect(queryPackSql("postgres://pack/db", "postgres://station/db", "select 1").rows).toEqual([]);
  });

  it("MCP send-shaped tools are denied", () => {
    expect(mcpToolAllowed("search_docs")).toBe(true);
    expect(mcpToolAllowed("mcp_send_mail")).toBe(false);
    expect(mcpToolAllowed("write_file")).toBe(false);
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
