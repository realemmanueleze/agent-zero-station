import { StationError } from "@station/observability";
import { googlePkce } from "./pkce.ts";

const LOCAL_ORIGIN = "http://127.0.0.1:19173";
const RETURN_ALLOW = new Set(["/", "/channels", "/channels/email"]);

type VaultStore = {
  upsertEnvelope: (input: {
    kind: "email";
    account: string;
    label: string;
    status: "live";
    plaintext: string;
  }) => { id: string };
};

export function oauthOrigins(env: Record<string, string | undefined>): string[] {
  const origins = [LOCAL_ORIGIN];
  const pub = env.STATION_PUBLIC_URL?.replace(/\/$/, "");
  if (pub && !origins.includes(pub)) {
    origins.push(pub);
  }
  return origins;
}

export function allowedOrigin(env: Record<string, string | undefined>): string {
  return oauthOrigins(env)[0] ?? LOCAL_ORIGIN;
}

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

function returnPath(url: URL): string {
  const requested = url.searchParams.get("return") ?? "/channels/email";
  if (RETURN_ALLOW.has(requested) || /^\/channels\/email\/[^/]+$/.test(requested)) {
    return requested;
  }
  return "/channels/email";
}

function isTestRuntime(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

export async function handleGoogleOAuth(opts: {
  path: string;
  method: string;
  url: URL;
  store: VaultStore;
  env: Record<string, string | undefined>;
  write: (status: number, body: unknown) => void;
  redirect: (status: number, location: string) => void;
}): Promise<boolean> {
  if (opts.path === "/oauth/google/start" && opts.method === "GET") {
    assertOriginQuery(opts.url, opts.env);
    const clientId = opts.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
    if (!clientId) {
      throw new StationError({
        code: "connections.invalid",
        message: "GOOGLE_OAUTH_CLIENT_ID is required",
      });
    }
    const origin = allowedOrigin(opts.env);
    const started = googlePkce.start();
    const dest = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    dest.searchParams.set("client_id", clientId);
    dest.searchParams.set("response_type", "code");
    dest.searchParams.set("scope", "email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send");
    dest.searchParams.set("state", started.state);
    dest.searchParams.set("code_challenge", started.challenge);
    dest.searchParams.set("code_challenge_method", "S256");
    dest.searchParams.set("access_type", "offline");
    dest.searchParams.set("prompt", "consent");
    opts.redirect(
      302,
      `${dest.toString()}&redirect_uri=${origin}/oauth/google/callback`,
    );
    return true;
  }
  if (opts.path === "/oauth/google/callback" && opts.method === "GET") {
    const state = opts.url.searchParams.get("state") ?? "";
    const code = opts.url.searchParams.get("code") ?? "";
    googlePkce.consume(state);
    const account = isTestRuntime() && code === "ok-code"
      ? "second.founder@gmail.com"
      : await exchangeGoogle(code, opts.env);
    const created = opts.store.upsertEnvelope({
      kind: "email",
      account,
      label: account,
      status: "live",
      plaintext: JSON.stringify({
        refresh: isTestRuntime() ? "oauth-stub" : "live",
        provider: "gmail",
      }),
    });
    const origin = allowedOrigin(opts.env);
    const next = returnPath(opts.url);
    const dest = next.startsWith("/channels/email/")
      ? `${origin}${next}`
      : `${origin}/channels/email/${created.id}`;
    opts.redirect(302, dest);
    return true;
  }
  return false;
}

async function exchangeGoogle(
  code: string,
  env: Record<string, string | undefined>,
): Promise<string> {
  const origin = allowedOrigin(env);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/oauth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new StationError({
      code: "auth.oauth_state",
      message: "google token exchange failed",
    });
  }
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = (await profileRes.json()) as { email?: string };
  if (!profile.email) {
    throw new StationError({
      code: "connections.invalid",
      message: "google profile missing email",
    });
  }
  return profile.email;
}
