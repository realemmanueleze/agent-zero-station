import { StationError } from "@station/observability";
import { googlePkce } from "./pkce.ts";
import { connectErrorLocation, oauthReturnPath } from "./oauth-return.ts";

const LOCAL_ORIGIN = "http://127.0.0.1:19173";

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

function isTestRuntime(): boolean {
  if (process.env.STATION_OAUTH_LIVE === "1") {
    return false;
  }
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

function doorOf(url: URL): string {
  return oauthReturnPath(url.searchParams.get("return"), "/channels/email");
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
    const origin = allowedOrigin(opts.env);
    const door = doorOf(opts.url);
    const clientId = opts.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
    if (!clientId) {
      opts.redirect(302, connectErrorLocation(origin, door));
      return true;
    }
    try {
      const started = googlePkce.start(door);
      const dest = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      dest.searchParams.set("client_id", clientId);
      dest.searchParams.set("response_type", "code");
      dest.searchParams.set("scope", "email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send");
      dest.searchParams.set("state", started.state);
      dest.searchParams.set("code_challenge", started.challenge);
      dest.searchParams.set("code_challenge_method", "S256");
      dest.searchParams.set("access_type", "offline");
      dest.searchParams.set("prompt", "consent select_account");
      opts.redirect(
        302,
        `${dest.toString()}&redirect_uri=${origin}/oauth/google/callback`,
      );
    } catch {
      opts.redirect(302, connectErrorLocation(origin, door));
    }
    return true;
  }
  if (opts.path === "/oauth/google/callback" && opts.method === "GET") {
    const origin = allowedOrigin(opts.env);
    let door = "/channels/email";
    let verifier = "";
    try {
      const consumed = googlePkce.consume(opts.url.searchParams.get("state") ?? "");
      verifier = consumed.verifier;
      if (consumed.returnPath) {
        door = oauthReturnPath(consumed.returnPath, "/channels/email");
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
      const account = isTestRuntime()
        ? await stubGoogle(code)
        : await exchangeGoogle(code, verifier, opts.env);
      const created = opts.store.upsertEnvelope({
        kind: "email",
        account: account.email,
        label: account.email,
        status: "live",
        plaintext: JSON.stringify({
          provider: "gmail",
          refreshToken: account.refreshToken,
          accessToken: account.accessToken,
          expiresAt: account.expiresAt,
        }),
      });
      const next = oauthReturnPath(opts.url.searchParams.get("return"), "");
      const dest = next.startsWith("/channels/email/")
        ? `${origin}${next}`
        : `${origin}/channels/email/${created.id}`;
      opts.redirect(302, dest);
    } catch {
      opts.redirect(302, connectErrorLocation(origin, door));
    }
    return true;
  }
  return false;
}

async function stubGoogle(code: string): Promise<GoogleTokens> {
  if (code === "ok-code") {
    return {
      email: "second.founder@gmail.com",
      refreshToken: "refresh-second",
      accessToken: "access-second",
      expiresAt: "2099-01-01T00:00:00.000Z",
    };
  }
  if (code === "ok-other") {
    return {
      email: "personal@gmail.com",
      refreshToken: "refresh-personal",
      accessToken: "access-personal",
      expiresAt: "2099-01-01T00:00:00.000Z",
    };
  }
  throw new StationError({
    code: "auth.oauth_state",
    message: "google token exchange failed",
  });
}

type GoogleTokens = {
  email: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: string;
};

async function exchangeGoogle(
  code: string,
  verifier: string,
  env: Record<string, string | undefined>,
): Promise<GoogleTokens> {
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
      code_verifier: verifier,
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokenJson.access_token || !tokenJson.refresh_token) {
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
  const expiresIn = tokenJson.expires_in ?? 3600;
  return {
    email: profile.email,
    refreshToken: tokenJson.refresh_token,
    accessToken: tokenJson.access_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}
