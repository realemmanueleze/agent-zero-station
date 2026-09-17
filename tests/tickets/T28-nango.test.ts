import { describe, expect, it } from "vitest";
import { StationError, errorCodes, toClientError } from "@station/observability";
import { getStation } from "@station/api";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { ConnectionStore } from "../../packages/station/src/connections.ts";
import {
  completeNangoConnection,
  createNangoSession,
  handleNangoRequest,
  importNangoConnections,
  nangoEnabled,
  nangoHost,
  nangoIntegrationFor,
  nangoWebhookSignature,
  NANGO_WEBHOOK_HMAC_HEADER,
  NANGO_WEBHOOK_MAX_BYTES,
  type NangoFetch,
} from "../../packages/station/src/nango.ts";

const MASTER = "local-dev-master-key-32-bytes!!!!";
const SECRET = "nango-secret-key-do-not-leak";

function sessionFetch(): typeof fetch {
  return (async (url, init) => {
    expect(String(url)).toMatch(/connect\/sessions/);
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${SECRET}`);
    return new Response(
      JSON.stringify({
        data: {
          token: "session-token",
          connect_link: "https://connect.nango.dev/link/abc",
          expires_at: "2026-09-07T01:00:00Z",
        },
      }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

describe("T28 Nango connect", () => {
  it("session without a secret is connections.invalid", async () => {
    await expect(
      createNangoSession({ kind: "email", env: {}, fetchImpl: sessionFetch() }),
    ).rejects.toMatchObject({ code: "connections.invalid" });
    expect(nangoEnabled({})).toBe(false);
  });

  it("session returns a connect link and never the secret", async () => {
    const started = await createNangoSession({
      kind: "email",
      env: { NANGO_SECRET_KEY: SECRET },
      fetchImpl: sessionFetch(),
    });
    expect(started.connectLink).toContain("connect.nango.dev");
    expect(started.integration).toBe("google-mail");
    expect(JSON.stringify(started)).not.toContain(SECRET);
    expect(nangoEnabled({ NANGO_SECRET_KEY: SECRET })).toBe(true);
  });

  it("complete upserts a live mailbox without storing the secret", () => {
    const env = { STATION_MASTER_KEY: MASTER, NANGO_SECRET_KEY: SECRET };
    const store = new ConnectionStore(() => env);
    const created = completeNangoConnection({
      store,
      env,
      connectionId: "conn-gmail-1",
      integration: "google-mail",
      account: "second@gmail.com",
    });
    expect(created.account).toBe("second@gmail.com");
    expect(created.status).toBe("live");
    expect(JSON.stringify(created)).not.toContain(SECRET);
    expect(store.decryptRow(store.get(created.id)!)).toContain("conn-gmail-1");
    expect(store.decryptRow(store.get(created.id)!)).not.toContain(SECRET);
  });

  it("import upserts listed Nango connections", async () => {
    const env = { STATION_MASTER_KEY: MASTER, NANGO_SECRET_KEY: SECRET };
    const store = new ConnectionStore(() => env);
    const imported = await importNangoConnections({
      env,
      store,
      fetchImpl: async () => ({
        status: 200,
        json: async () => ({
          connections: [
            {
              connection_id: "conn-imported",
              provider_config_key: "google-mail",
              end_user: { email: "import@gmail.com" },
            },
          ],
        }),
      }),
    });
    expect(imported.items.some((row) => row.account === "import@gmail.com")).toBe(true);
    expect(JSON.stringify(imported)).not.toContain(SECRET);
  });

  it("first-party Google start still works when Nango is unset", async () => {
    const station = getStation({ seed: false });
    station.config.load({
      STATION_MASTER_KEY: MASTER,
      GOOGLE_OAUTH_CLIENT_ID: "cid",
      GOOGLE_OAUTH_CLIENT_SECRET: "sec",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t28" });
    try {
      const start = await fetch(`http://127.0.0.1:${bound.port}/oauth/google/start`, {
        redirect: "manual",
        headers: { authorization: "Bearer t28" },
      });
      expect(start.status).toBe(302);
    } finally {
      await bound.close();
    }
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });

  it("connections.nango_failed is retryable 502 client JSON", async () => {
    expect(errorCodes["connections.nango_failed"]).toEqual({ status: 502, retryable: true });
    const json = toClientError(
      new StationError({ code: "connections.nango_failed", message: "nango session failed", requestId: "req-nango" }),
    );
    expect(json.error.code).toBe("connections.nango_failed");
    expect(json.error.requestId).toBe("req-nango");
    expect(JSON.stringify(json)).not.toMatch(/stack/i);
    await expect(
      createNangoSession({
        kind: "email",
        env: { NANGO_SECRET_KEY: SECRET },
        fetchImpl: async () => ({ status: 502, json: async () => ({}) }),
      }),
    ).rejects.toMatchObject({ code: "connections.nango_failed" });
    await expect(
      createNangoSession({
        kind: "email",
        env: { NANGO_SECRET_KEY: SECRET },
        fetchImpl: async () => ({ status: 200, json: async () => ({ data: { connect_link: "" } }) }),
      }),
    ).rejects.toMatchObject({ code: "connections.nango_failed" });
    const store = new ConnectionStore(() => ({ STATION_MASTER_KEY: MASTER, NANGO_SECRET_KEY: SECRET }));
    await expect(
      importNangoConnections({
        env: { NANGO_SECRET_KEY: SECRET },
        store,
        fetchImpl: async () => ({ status: 401, json: async () => ({}) }),
      }),
    ).rejects.toMatchObject({ code: "connections.nango_failed" });
  });

  it("drive and paste kinds cannot open a Nango session", async () => {
    expect(() => nangoIntegrationFor("obsidian", {})).toThrow(StationError);
    expect(() => nangoIntegrationFor("db", {})).toThrow(StationError);
    expect(() => nangoIntegrationFor("mcp", {})).toThrow(StationError);
    expect(() => nangoIntegrationFor("drive", {})).not.toThrow();
    await expect(
      createNangoSession({ kind: "drive", env: { NANGO_SECRET_KEY: SECRET }, fetchImpl: sessionFetch() }),
    ).rejects.toMatchObject({ code: "connections.invalid" });
  });

  it("slack session uses the host, integration env, and public webhook override", async () => {
    let posted: { url: string; body: string } | undefined;
    const started = await createNangoSession({
      kind: "slack",
      env: {
        NANGO_SECRET_KEY: SECRET,
        NANGO_HOST: "https://nango.example/",
        NANGO_INTEGRATION_SLACK: "acme-slack",
        STATION_PUBLIC_URL: "https://station.example/",
      },
      fetchImpl: async (url, init) => {
        posted = { url: String(url), body: init?.body ?? "" };
        return {
          status: 201,
          json: async () => ({ data: { connect_link: "https://connect.nango.dev/link/slack", expires_at: "2026-09-07T01:00:00Z" } }),
        };
      },
    });
    expect(nangoHost({ NANGO_HOST: "https://nango.example/" })).toBe("https://nango.example");
    expect(started.integration).toBe("acme-slack");
    expect(posted?.url).toBe("https://nango.example/connect/sessions");
    expect(posted?.body).toContain("acme-slack");
    expect(posted?.body).toContain("https://station.example/api/nango/webhook");
    expect(JSON.stringify(started)).not.toContain(SECRET);
  });

  it("complete and import skip unknown integrations and require ids", async () => {
    const env = { STATION_MASTER_KEY: MASTER, NANGO_SECRET_KEY: SECRET };
    const store = new ConnectionStore(() => env);
    expect(() =>
      completeNangoConnection({ store, env, connectionId: "", integration: "google-mail", account: "a@x.com" }),
    ).toThrow(/connection id and account/i);
    const slack = completeNangoConnection({
      store,
      env,
      connectionId: "conn-slack",
      integration: "slack",
      account: "acme-hq",
    });
    expect(slack.kind).toBe("slack");
    expect(slack.status).toBe("live");
    const imported = await importNangoConnections({
      env,
      store,
      fetchImpl: async () => ({
        status: 200,
        json: async () => ({
          connections: [
            { connection_id: "drive-1", provider_config_key: "google-drive", end_user: { email: "drive@x.com" } },
            { provider_config_key: "google-mail", end_user: { email: "orphan@x.com" } },
            { connection_id: "ok-2", provider_config_key: "google-mail", end_user: { email: "kept@x.com" } },
          ],
        }),
      }),
    });
    expect(imported.items.map((row) => row.account)).toEqual(["kept@x.com"]);
  });

  it("handleNangoRequest covers status, session, start, complete, import, and webhook", async () => {
    const env = { STATION_MASTER_KEY: MASTER, NANGO_SECRET_KEY: SECRET };
    const store = new ConnectionStore(() => env);
    const fetchImpl: NangoFetch = async (url) => {
      if (String(url).includes("/connections")) {
        return {
          status: 200,
          json: async () => ({
            connections: [
              { connection_id: "from-import", provider_config_key: "google-mail", end_user: { email: "import2@x.com" } },
            ],
          }),
        };
      }
      return {
        status: 201,
        json: async () => ({ data: { connect_link: "https://connect.nango.dev/link/http", expires_at: "2026-09-07T01:00:00Z" } }),
      };
    };
    const run = async (path: string, method: string, body = "", search = "") => {
      const writes: Array<{ status: number; body: unknown }> = [];
      const redirects: Array<{ status: number; location: string }> = [];
      const handled = await handleNangoRequest({
        path,
        method,
        url: new URL(`http://127.0.0.1${path}${search}`),
        body,
        store,
        env,
        write: (status, json) => writes.push({ status, body: json }),
        redirect: (status, location) => redirects.push({ status, location }),
        fetchImpl,
        headers: { [NANGO_WEBHOOK_HMAC_HEADER]: nangoWebhookSignature(SECRET, body) },
      });
      return { handled, writes, redirects };
    };
    const status = await run("/nango/status", "GET");
    expect(status).toMatchObject({ handled: true, writes: [{ status: 200, body: { enabled: true } }] });
    const session = await run("/nango/session", "POST", JSON.stringify({ kind: "email" }));
    expect(session.handled).toBe(true);
    expect((session.writes[0]?.body as { connectLink?: string }).connectLink).toContain("connect.nango.dev");
    const start = await run("/nango/start", "GET", "", "?kind=slack");
    expect(start.redirects[0]).toEqual({ status: 302, location: "https://connect.nango.dev/link/http" });
    const complete = await run(
      "/nango/complete",
      "POST",
      JSON.stringify({ connectionId: "http-1", integration: "google-mail", account: "http@x.com" }),
    );
    expect((complete.writes[0]?.body as { account?: string }).account).toBe("http@x.com");
    const imported = await run("/nango/import", "POST");
    expect((imported.writes[0]?.body as { items: Array<{ account: string }> }).items[0]?.account).toBe("import2@x.com");
    const failedHook = await run("/nango/webhook", "POST", JSON.stringify({ success: false }));
    expect(failedHook.writes[0]?.body).toEqual({ ok: true });
    const okHook = await run(
      "/nango/webhook",
      "POST",
      JSON.stringify({
        success: true,
        connectionId: "hook-1",
        providerConfigKey: "google-mail",
        endUser: { email: "hook@x.com" },
      }),
    );
    expect((okHook.writes[0]?.body as { account?: string }).account).toBe("hook@x.com");
    expect((await run("/nango/nope", "GET")).handled).toBe(false);
  });

  it("worker HTTP exposes nango status and maps missing-secret session to client JSON", async () => {
    const station = getStation({ seed: false });
    station.config.load({ STATION_MASTER_KEY: MASTER });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t28-http" });
    try {
      const headers = { authorization: "Bearer t28-http" };
      const off = await fetch(`http://127.0.0.1:${bound.port}/nango/status`, { headers });
      expect(await off.json()).toEqual({ enabled: false });
      const session = await fetch(`http://127.0.0.1:${bound.port}/nango/session`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ kind: "email" }),
      });
      const sessionJson = (await session.json()) as { error?: { code?: string } };
      expect(session.status).toBe(400);
      expect(sessionJson.error?.code).toBe("connections.invalid");
      const denied = await fetch(`http://127.0.0.1:${bound.port}/nango/session`, {
        method: "POST",
        body: "{}",
      });
      expect(denied.status).toBe(401);
      station.config.load({ NANGO_SECRET_KEY: SECRET });
      const failBody = JSON.stringify({ success: false });
      const hook = await fetch(`http://127.0.0.1:${bound.port}/nango/webhook`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-nango-hmac-sha256": nangoWebhookSignature(SECRET, failBody),
        },
        body: failBody,
      });
      expect(hook.status).toBe(200);
      expect(await hook.json()).toEqual({ ok: true });
      const bad = await fetch(`http://127.0.0.1:${bound.port}/nango/webhook`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json", "x-nango-hmac-sha256": "deadbeef" },
        body: failBody,
      });
      expect(bad.status).toBe(400);
      const on = await fetch(`http://127.0.0.1:${bound.port}/nango/status`, { headers });
      expect(await on.json()).toEqual({ enabled: true });
    } finally {
      await bound.close();
    }
  });

  it("malformed nango JSON is connections.invalid", async () => {
    const env = { STATION_MASTER_KEY: MASTER, NANGO_SECRET_KEY: SECRET };
    const store = new ConnectionStore(() => env);
    await expect(
      handleNangoRequest({
        path: "/nango/session",
        method: "POST",
        url: new URL("http://127.0.0.1/nango/session"),
        body: "{not-json",
        store,
        env,
        write: () => undefined,
        redirect: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "connections.invalid" });
    for (const body of ["null", "[]", JSON.stringify({ kind: "obsidian" })]) {
      await expect(
        handleNangoRequest({
          path: "/nango/session",
          method: "POST",
          url: new URL("http://127.0.0.1/nango/session"),
          body,
          store,
          env,
          write: () => undefined,
          redirect: () => undefined,
        }),
      ).rejects.toMatchObject({ code: "connections.invalid" });
    }
  });

  it("webhook HMAC uses the webhook signing key over X-Nango-Hmac-Sha256", async () => {
    const webhookSecret = "nango-webhook-signing-key";
    const env = { STATION_MASTER_KEY: MASTER, NANGO_SECRET_KEY: SECRET, NANGO_WEBHOOK_SECRET: webhookSecret };
    const store = new ConnectionStore(() => env);
    const body = JSON.stringify({ success: false });
    const writes: Array<{ status: number; body: unknown }> = [];
    await handleNangoRequest({
      path: "/nango/webhook",
      method: "POST",
      url: new URL("http://127.0.0.1/nango/webhook"),
      body,
      store,
      env,
      write: (status, json) => writes.push({ status, body: json }),
      redirect: () => undefined,
      headers: { [NANGO_WEBHOOK_HMAC_HEADER]: nangoWebhookSignature(webhookSecret, body) },
    });
    expect(writes[0]).toEqual({ status: 200, body: { ok: true } });
    await expect(
      handleNangoRequest({
        path: "/nango/webhook",
        method: "POST",
        url: new URL("http://127.0.0.1/nango/webhook"),
        body,
        store,
        env,
        write: () => undefined,
        redirect: () => undefined,
        headers: { [NANGO_WEBHOOK_HMAC_HEADER]: nangoWebhookSignature(SECRET, body) },
      }),
    ).rejects.toMatchObject({ code: "connections.invalid" });
    const huge = "x".repeat(NANGO_WEBHOOK_MAX_BYTES + 1);
    await expect(
      handleNangoRequest({
        path: "/nango/webhook",
        method: "POST",
        url: new URL("http://127.0.0.1/nango/webhook"),
        body: huge,
        store,
        env,
        write: () => undefined,
        redirect: () => undefined,
        headers: { [NANGO_WEBHOOK_HMAC_HEADER]: nangoWebhookSignature(webhookSecret, huge) },
      }),
    ).rejects.toMatchObject({ code: "connections.invalid" });
  });

  it("webhook ignores sync events, deleted rows, and missing email", async () => {
    const env = { STATION_MASTER_KEY: MASTER, NANGO_SECRET_KEY: SECRET };
    const store = new ConnectionStore(() => env);
    const first = completeNangoConnection({
      store,
      env,
      connectionId: "conn-keep",
      integration: "google-mail",
      account: "keep@x.com",
    });
    const replayed = completeNangoConnection({
      store,
      env,
      connectionId: "conn-other",
      integration: "google-mail",
      account: "keep@x.com",
    });
    expect(replayed.id).toBe(first.id);
    expect(store.decryptRow(store.get(first.id)!)).toContain("conn-keep");
    store.remove(first.id);
    const run = async (body: string) => {
      const writes: Array<{ status: number; body: unknown }> = [];
      await handleNangoRequest({
        path: "/nango/webhook",
        method: "POST",
        url: new URL("http://127.0.0.1/nango/webhook"),
        body,
        store,
        env,
        write: (status, json) => writes.push({ status, body: json }),
        redirect: () => undefined,
        headers: { [NANGO_WEBHOOK_HMAC_HEADER]: nangoWebhookSignature(SECRET, body) },
      });
      return writes[0];
    };
    expect(await run(JSON.stringify({ type: "sync", connectionId: "conn-keep", providerConfigKey: "google-mail" }))).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(await run(JSON.stringify({
      type: "auth",
      connectionId: "conn-new",
      providerConfigKey: "google-mail",
      endUser: { email: "keep@x.com" },
    }))).toEqual({ status: 200, body: { ok: true } });
    expect(store.get(first.id)?.status).toBe("deleted");
    expect(await run(JSON.stringify({
      type: "auth",
      connectionId: "conn-no-mail",
      providerConfigKey: "google-mail",
    }))).toEqual({ status: 200, body: { ok: true } });
  });
});
