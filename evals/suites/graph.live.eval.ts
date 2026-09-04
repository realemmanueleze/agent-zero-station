import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { pollGraphInbox, sendGraphMail, type GraphFetch } from "@station/channels";

describe("graph.live (gate: merge)", () => {
  it("poll then sendMail once; model never sends", async () => {
    const calls: string[] = [];
    const fetchImpl: GraphFetch = async (url, init) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("messages")) {
        return {
          status: 200,
          json: async () => ({
            value: [
              {
                from: { emailAddress: { address: "buyer@example.com" } },
                conversationId: "t",
                subject: "Hi",
                body: { content: "hello" },
              },
            ],
          }),
        };
      }
      return { status: 202, json: async () => ({}) };
    };
    const env = { STATION_GRAPH_TOKEN: "eval-token" };
    const inbox = await pollGraphInbox(env, fetchImpl);
    expect(inbox).toHaveLength(1);
    await sendGraphMail(env, { to: inbox[0]?.from ?? "", body: "reply" }, fetchImpl);
    expect(calls.filter((row) => row.includes("sendMail"))).toHaveLength(1);
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
