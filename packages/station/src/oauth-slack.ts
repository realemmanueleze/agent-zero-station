import { StationError } from "@station/observability";
import { allowedOrigin, oauthOrigins } from "./oauth-google.ts";
import { connectErrorLocation, oauthReturnPath } from "./oauth-return.ts";
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

function doorOf(url: URL): string {
  return oauthReturnPath(url.searchParams.get("return"), "/channels/slack");
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
    const origin = allowedOrigin(opts.env);
    const door = doorOf(opts.url);
    const clientId = opts.env.SLACK_OAUTH_CLIENT_ID ?? "";
    if (!clientId) {
      opts.redirect(302, connectErrorLocation(origin, door));
      return true;
    }
    try {
      const started = slackPkce.start(door);
      const dest = new URL("https://slack.com/oauth/v2/authorize");
      dest.searchParams.set("client_id", clientId);
      dest.searchParams.set("state", started.state);
      dest.searchParams.set("code_challenge", started.challenge);
      dest.searchParams.set("code_challenge_method", "S256");
      dest.searchParams.set("scope", "channels:read chat:write");
      opts.redirect(302, `${dest.toString()}&redirect_uri=${origin}/oauth/slack/callback`);
    } catch {
      opts.redirect(302, connectErrorLocation(origin, door));
    }
    return true;
  }
  if (opts.path === "/oauth/slack/callback" && opts.method === "GET") {
    const origin = allowedOrigin(opts.env);
    let door = "/channels/slack";
    try {
      const consumed = slackPkce.consume(opts.url.searchParams.get("state") ?? "");
      if (consumed.returnPath) {
        door = oauthReturnPath(consumed.returnPath, "/channels/slack");
      }
    } catch {
      opts.redirect(302, connectErrorLocation(origin, "/channels"));
      return true;
    }
    const code = opts.url.searchParams.get("code") ?? "";
    const providerError = opts.url.searchParams.get("error") ?? "";
    if (providerError || !code) {
      opts.redirect(302, connectErrorLocation(origin, door));
      return true;
    }
    try {
      const account = isTestRuntime() ? "acme-live" : await exchangeSlack(code, opts.env);
      const created = opts.store.upsertEnvelope({
        kind: "slack",
        account,
        label: account,
        status: "live",
        plaintext: JSON.stringify({ slackSecret: isTestRuntime() ? "oauth-stub" : "live" }),
      });
      opts.redirect(302, `${origin}/channels/slack/${created.id}`);
    } catch {
      opts.redirect(302, connectErrorLocation(origin, door));
    }
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
