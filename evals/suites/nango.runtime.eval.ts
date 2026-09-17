import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { pollNangoAccount } from "../../packages/station/src/nango-runtime.ts";

const SECRET = "nango-runtime-eval-secret";

describe("nango.runtime (gate: merge)", () => {
  it("mocked Gmail poll returns inbound without the secret or a send", async () => {
    const inbound = await pollNangoAccount({
      kind: "email",
      account: "eval@gmail.com",
      envelope: { provider: "nango", connectionId: "eval-conn", integration: "google-mail" },
      env: { NANGO_SECRET_KEY: SECRET },
      fetchImpl: async (url) => {
        if (url.includes("/messages/") && !url.includes("q=is:unread")) {
          return {
            status: 200,
            json: async () => ({
              payload: {
                headers: [
                  { name: "From", value: "buyer@northwind.io" },
                  { name: "Subject", value: "Quote" },
                ],
                body: { data: Buffer.from("twelve seats").toString("base64url") },
              },
            }),
          };
        }
        return { status: 200, json: async () => ({ messages: [{ id: "eval-m1" }] }) };
      },
    });
    expect(inbound[0]?.from).toBe("buyer@northwind.io");
    expect(JSON.stringify(inbound)).not.toContain(SECRET);
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
