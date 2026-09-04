import { describe, expect, it } from "vitest";
import { getStation } from "@station/api";
import { scoringTurnCallsCommitSend } from "@station/loop";
import {
  pollGraphInbox,
  requireGraphConfig,
  sendGraphMail,
  type GraphFetch,
} from "@station/channels";

const env = { STATION_GRAPH_TOKEN: "graph-test-token" };

function fakeFetch(status: number, body: unknown, sink?: string[]): GraphFetch {
  return async (url, init) => {
    sink?.push(`${init?.method ?? "GET"} ${url}`);
    return {
      status,
      json: async () => body,
    };
  };
}

describe("T19 graph live", () => {
  it("missing Graph config is config.graph_required", () => {
    expect(() => requireGraphConfig({})).toThrow(
      expect.objectContaining({ code: "config.graph_required" }),
    );
  });

  it("injected poll returns a normalized payload", async () => {
    const rows = await pollGraphInbox(
      env,
      fakeFetch(200, {
        value: [
          {
            from: { emailAddress: { address: "buyer@example.com" } },
            conversationId: "thread-9",
            subject: "Quote",
            body: { content: "Need 12 seats for $12400" },
          },
        ],
      }),
    );
    expect(rows[0]?.from).toBe("buyer@example.com");
    expect(rows[0]?.threadId).toBe("thread-9");
    expect(rows[0]?.amount).toBe(12400);
  });

  it("sendGraphMail posts /me/sendMail", async () => {
    const sink: string[] = [];
    const receipt = await sendGraphMail(
      env,
      { to: "buyer@example.com", body: "hello", subject: "Quote" },
      fakeFetch(202, {}, sink),
    );
    expect(receipt.providerId).toContain("buyer@example.com");
    expect(sink.join("\n")).toMatch(/POST https:\/\/graph\.microsoft\.com\/v1\.0\/me\/sendMail/);
    expect(sink.join("\n")).not.toMatch(/DATA/i);
  });

  it("401 is auth.graph; 429 is retryable", async () => {
    await expect(pollGraphInbox(env, fakeFetch(401, {}))).rejects.toMatchObject({
      code: "auth.graph",
    });
    await expect(sendGraphMail(env, { to: "x", body: "y" }, fakeFetch(429, {}))).rejects.toMatchObject({
      code: "send.provider_failed",
      retryable: true,
    });
  });

  it("T7 normalize still maps Graph JSON", () => {
    const payload = getStation().graph.normalizeSignal({
      from: { emailAddress: { address: "buyer@example.com" } },
      conversationId: "thread-1",
      subject: "Quote",
      body: { content: "Need 12 seats for $12400" },
    });
    expect(payload.from).toBe("buyer@example.com");
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
