import { StationError } from "@station/observability";
import { allowedOrigin, oauthOrigins } from "./oauth-google.ts";
import { slackPkce } from "./pkce.ts";

type VaultStore = {
  upsertEnvelope: (input: {
    kind: "slack";
    account: string;
    label: string;
    status: "live";
    plaintext: string;
  }) => { id: string };
};

function assertOriginQuery(url: URL, env: Record<string, string | undefined>): void {
  if (!url.searchParams.has("origin")) {
    return;
  }
  const requested = url.searchParams.get("origin") ?? "";
  if (!oauthOrigins(env).includes(requested.replace(/\/$/, ""))) {
    throw new StationError({
      code: "connections.invalid",
      message: "oauth origin is not allowlisted",
    });
  }
}

function isTestRuntime(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

export async function handleSlackOAuth(opts: {
  path: string;
  method: string;
  url: URL;
  store: VaultStore;
  env: Record<string, string | undefined>;
  write: (status: number, body: unknown) => void;
  redirect: (status: number, location: string) => void;
}): Promise<boolean> {
  if (opts.path === "/oauth/slack/start" && opts.method === "GET") {
    assertOriginQuery(opts.url, opts.env);
    const clientId = opts.env.SLACK_OAUTH_CLIENT_ID ?? "";
    if (!clientId) {
      throw new StationError({
        code: "connections.invalid",
        message: "SLACK_OAUTH_CLIENT_ID is required",
      });
    }
    const origin = allowedOrigin(opts.env);
    const started = slackPkce.start();
    const dest = new URL("https://slack.com/oauth/v2/authorize");
    dest.searchParams.set("client_id", clientId);
    dest.searchParams.set("state", started.state);
    dest.searchParams.set("code_challenge", started.challenge);
    dest.searchParams.set("code_challenge_method", "S256");
    dest.searchParams.set("scope", "channels:read chat:write");
    opts.redirect(302, `${dest.toString()}&redirect_uri=${origin}/oauth/slack/callback`);
    return true;
  }
  if (opts.path === "/oauth/slack/callback" && opts.method === "GET") {
    const state = opts.url.searchParams.get("state") ?? "";
    slackPkce.consume(state);
    const account = isTestRuntime() ? "acme-live" : await exchangeSlack(opts.url.searchParams.get("code") ?? "", opts.env);
    const created = opts.store.upsertEnvelope({
      kind: "slack",
      account,
      label: account,
      status: "live",
      plaintext: JSON.stringify({ slackSecret: isTestRuntime() ? "oauth-stub" : "live" }),
    });
    opts.redirect(302, `${allowedOrigin(opts.env)}/channels/slack/${created.id}`);
    return true;
  }
  return false;
}

async function exchangeSlack(
  code: string,
  env: Record<string, string | undefined>,
): Promise<string> {
  const origin = allowedOrigin(env);
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.SLACK_OAUTH_CLIENT_ID ?? "",
      client_secret: env.SLACK_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/oauth/slack/callback`,
    }),
  });
  const json = (await res.json()) as { ok?: boolean; team?: { id?: string } };
  if (!json.ok || !json.team?.id) {
    throw new StationError({
      code: "auth.oauth_state",
      message: "slack token exchange failed",
    });
  }
  return json.team.id;
}
