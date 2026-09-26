import { afterEach, describe, expect, it } from "vitest";
import { GET as googleStart } from "./google/start/route.ts";
import { GET as slackStart } from "./slack/start/route.ts";

describe("oauth start routes forward return", () => {
  afterEach(() => {
    delete process.env.STATION_WORKER_URL;
    delete process.env.STATION_CONTROL_TOKEN;
  });

  it("forwards return= to the worker and 302s Location on success", async () => {
    process.env.STATION_WORKER_URL = "http://oauth-proxy.test";
    process.env.STATION_CONTROL_TOKEN = "desk-mock-token";
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: "https://accounts.google.com/o/oauth2/v2/auth" },
      });
    }) as typeof fetch;
    try {
      const google = await googleStart(
        new Request("http://cockpit/oauth/google/start?return=/channels/email"),
      );
      expect(google.status).toBe(302);
      expect(google.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      const slack = await slackStart(
        new Request("http://cockpit/oauth/slack/start?return=/channels"),
      );
      expect(slack.status).toBe(302);
      expect(calls).toEqual([
        "http://oauth-proxy.test/oauth/google/start?return=%2Fchannels%2Femail",
        "http://oauth-proxy.test/oauth/slack/start?return=%2Fchannels",
      ]);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
