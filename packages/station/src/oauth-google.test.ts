import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionStore } from "./connections.ts";
import { handleGoogleOAuth } from "./oauth-google.ts";
import { googlePkce } from "./pkce.ts";

const env = {
  GOOGLE_OAUTH_CLIENT_ID: "cid",
  GOOGLE_OAUTH_CLIENT_SECRET: "sec",
};

async function run(path: string, search: string, givenEnv = env) {
  const redirects: Array<{ status: number; location: string }> = [];
  const url = new URL(`http://127.0.0.1${path}${search}`);
  await handleGoogleOAuth({
    path,
    method: "GET",
    url,
    store: {
      upsertEnvelope: () => ({ id: "mail-1" }),
    },
    env: givenEnv,
    write: () => undefined,
    redirect: (status, location) => {
      redirects.push({ status, location });
    },
  });
  return redirects;
}

describe("Google OAuth return", () => {
  it("start without a client id 302s to the door, not JSON", async () => {
    const redirects = await run("/oauth/google/start", "?return=/channels/email", {});
    expect(redirects[0]).toEqual({
      status: 302,
      location: "http://127.0.0.1:19173/channels/email?connect=error",
    });
  });

  it("stores return on PKCE and deny 302s there", async () => {
    const start = await run("/oauth/google/start", "?return=/channels");
    const dest = new URL(start[0]?.location ?? "");
    const state = dest.searchParams.get("state") ?? "";
    expect(state.length).toBeGreaterThan(0);
    const deny = await run("/oauth/google/callback", `?error=access_denied&state=${state}`);
    expect(deny[0]).toEqual({
      status: 302,
      location: "http://127.0.0.1:19173/channels?connect=error",
    });
  });

  it("start asks Google to pick an account and return a refresh token", async () => {
    const start = await run("/oauth/google/start", "?return=/channels/email");
    const dest = new URL(start[0]?.location ?? "");
    expect(dest.searchParams.get("access_type")).toBe("offline");
    expect(dest.searchParams.get("prompt")).toBe("consent select_account");
  });

  it("success still lands on the created mailbox", async () => {
    const start = await run("/oauth/google/start", "?return=/channels");
    const dest = new URL(start[0]?.location ?? "");
    const state = dest.searchParams.get("state") ?? "";
    const ok = await run("/oauth/google/callback", `?code=ok-code&state=${state}`);
    expect(ok[0]?.location).toBe("http://127.0.0.1:19173/channels/email/mail-1");
  });

  it("expired state 302s to Channels", async () => {
    const deny = await run("/oauth/google/callback", "?code=ok-code&state=missing");
    expect(deny[0]?.location).toBe("http://127.0.0.1:19173/channels?connect=error");
    expect(() => googlePkce.consume("missing")).toThrow();
  });

  it("live exchange sends the PKCE verifier that started the sign-in", async () => {
    const previous = process.env.STATION_OAUTH_LIVE;
    process.env.STATION_OAUTH_LIVE = "1";
    const bodies: string[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        if (init?.body) {
          bodies.push(String(init.body));
        }
        return new Response(
          JSON.stringify({ access_token: "access-live", refresh_token: "refresh-live", expires_in: 3600 }),
        );
      }
      return new Response(JSON.stringify({ email: "founder@gmail.com" }));
    });
    try {
      const start = await run("/oauth/google/start", "?return=/channels/email");
      const state = new URL(start[0]?.location ?? "").searchParams.get("state") ?? "";
      const ok = await run("/oauth/google/callback", `?code=live-code&state=${state}`);
      expect(ok[0]?.location).toBe("http://127.0.0.1:19173/channels/email/mail-1");
      const sent = new URLSearchParams(bodies[0] ?? "");
      expect(sent.get("code_verifier")?.length).toBeGreaterThan(20);
      expect(sent.get("code")).toBe("live-code");
      expect(sent.get("redirect_uri")).toBe("http://127.0.0.1:19173/oauth/google/callback");
    } finally {
      fetchMock.mockRestore();
      if (previous === undefined) {
        delete process.env.STATION_OAUTH_LIVE;
      } else {
        process.env.STATION_OAUTH_LIVE = previous;
      }
    }
  });

  it("two Google sign-ins keep two mailboxes and encrypt each refresh token", async () => {
    const store = new ConnectionStore(() => ({ STATION_MASTER_KEY: "local-dev-master-key-32-bytes!!!!" }));
    const land = async (code: string) => {
      const start = await handle("/oauth/google/start", "?return=/channels/email", store);
      const state = new URL(start[0]?.location ?? "").searchParams.get("state") ?? "";
      return handle("/oauth/google/callback", `?code=${code}&state=${state}`, store);
    };
    const first = await land("ok-code");
    const second = await land("ok-other");
    expect(first[0]?.location).toMatch(/\/channels\/email\//);
    expect(second[0]?.location).not.toBe(first[0]?.location);
    const listed = store.list();
    expect(listed.map((row) => row.account).sort()).toEqual([
      "personal@gmail.com",
      "second.founder@gmail.com",
    ]);
    const raw = JSON.stringify(listed);
    expect(raw).not.toContain("refresh-second");
    expect(raw).not.toContain("refresh-personal");
    const tokens = listed.map((row) => {
      const stored = store.find("email", row.account);
      const fields = JSON.parse(store.decryptRow(stored!)) as { refreshToken?: string };
      return fields.refreshToken;
    });
    expect(tokens.sort()).toEqual(["refresh-personal", "refresh-second"]);
    await land("ok-code");
    expect(store.list().filter((row) => row.account === "second.founder@gmail.com")).toHaveLength(1);
  });
});

async function handle(
  path: string,
  search: string,
  store: ConnectionStore,
) {
  const redirects: Array<{ status: number; location: string }> = [];
  await handleGoogleOAuth({
    path,
    method: "GET",
    url: new URL(`http://127.0.0.1${path}${search}`),
    store,
    env,
    write: () => undefined,
    redirect: (status, location) => {
      redirects.push({ status, location });
    },
  });
  return redirects;
}
