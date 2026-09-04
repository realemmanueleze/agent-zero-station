import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { mcpToolAllowed, queryPackSql, slackPostMessage } from "@station/channels";

describe("adapters.live (gate: merge)", () => {
  it("slack posts, pack SQL is read-only, model never sends", async () => {
    const posted = await slackPostMessage("xoxb-eval", "C9", "hi", async () => ({
      status: 200,
      json: async () => ({ ok: true }),
    }));
    expect(posted.ok).toBe(true);
    expect(() =>
      queryPackSql("postgres://pack/db", "postgres://station/db", "delete from deals"),
    ).toThrow();
    expect(mcpToolAllowed("post_message")).toBe(false);
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
