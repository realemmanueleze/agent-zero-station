import { describe, expect, it } from "vitest";
import { handleSlackOAuth } from "./oauth-slack.ts";

const env = {
  SLACK_OAUTH_CLIENT_ID: "sid",
  SLACK_OAUTH_CLIENT_SECRET: "sec",
};

async function run(path: string, search: string, givenEnv = env) {
  const redirects: Array<{ status: number; location: string }> = [];
  await handleSlackOAuth({
    path,
    method: "GET",
    url: new URL(`http://127.0.0.1${path}${search}`),
    store: {
      upsertEnvelope: () => ({ id: "slack-1" }),
    },
    env: givenEnv,
    write: () => undefined,
    redirect: (status, location) => {
      redirects.push({ status, location });
    },
  });
  return redirects;
}

describe("Slack OAuth return", () => {
  it("start without a client id 302s to the Slack door", async () => {
    const redirects = await run("/oauth/slack/start", "?return=/channels/slack", {});
    expect(redirects[0]).toEqual({
      status: 302,
      location: "http://127.0.0.1:19173/channels/slack?connect=error",
    });
  });

  it("deny 302s to the stored return, not Back to email HTML", async () => {
    const start = await run("/oauth/slack/start", "?return=/channels");
    const dest = new URL(start[0]?.location ?? "");
    const state = dest.searchParams.get("state") ?? "";
    const deny = await run("/oauth/slack/callback", `?error=access_denied&state=${state}`);
    expect(deny[0]).toEqual({
      status: 302,
      location: "http://127.0.0.1:19173/channels?connect=error",
    });
  });

  it("success still lands on the created workspace", async () => {
    const start = await run("/oauth/slack/start", "?return=/channels");
    const dest = new URL(start[0]?.location ?? "");
    const state = dest.searchParams.get("state") ?? "";
    const ok = await run("/oauth/slack/callback", `?code=ok-code&state=${state}`);
    expect(ok[0]?.location).toBe("http://127.0.0.1:19173/channels/slack/slack-1");
  });
});
