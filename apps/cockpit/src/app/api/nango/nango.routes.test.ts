import { afterEach, describe, expect, it } from "vitest";
import { GET as nangoStatus } from "./status/route.ts";
import { POST as nangoSession } from "./session/route.ts";
import { POST as nangoImport } from "./import/route.ts";
import { POST as nangoWebhook } from "./webhook/route.ts";
import { GET as nangoStart } from "../../nango/start/route.ts";
import { POST as packActivate } from "../../packs/[id]/activate/route.ts";

const worker = "http://nango-proxy.test";

async function withWorkerFetch(handler: (calls: Array<{ url: string; init?: RequestInit }>) => Promise<void>): Promise<void> {
  const prevUrl = process.env.STATION_WORKER_URL;
  const prevToken = process.env.STATION_CONTROL_TOKEN;
  process.env.STATION_WORKER_URL = worker;
  process.env.STATION_CONTROL_TOKEN = "desk-mock-token";
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const url = String(input);
    if (url.endsWith("/nango/status")) {
      return new Response(JSON.stringify({ enabled: true }), { status: 200 });
    }
    if (url.endsWith("/nango/session")) {
      return new Response(JSON.stringify({ connectLink: "https://connect.nango.dev/x" }), { status: 200 });
    }
    if (url.endsWith("/nango/import")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (url.endsWith("/nango/webhook")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes("/nango/start")) {
      return new Response(null, { status: 302, headers: { location: "https://connect.nango.dev/link" } });
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  try {
    await handler(calls);
  } finally {
    globalThis.fetch = orig;
    if (prevUrl === undefined) {
      delete process.env.STATION_WORKER_URL;
    } else {
      process.env.STATION_WORKER_URL = prevUrl;
    }
    if (prevToken === undefined) {
      delete process.env.STATION_CONTROL_TOKEN;
    } else {
      process.env.STATION_CONTROL_TOKEN = prevToken;
    }
  }
}

describe("cockpit Nango and pack proxies", () => {
  afterEach(() => {
    delete process.env.STATION_WORKER_URL;
    delete process.env.STATION_CONTROL_TOKEN;
  });

  it("proxies status, session, import, and webhook without dropping worker status", async () => {
    await withWorkerFetch(async (calls) => {
      const status = await nangoStatus();
      expect(status.status).toBe(200);
      expect(await status.json()).toEqual({ enabled: true });
      const session = await nangoSession(new Request("http://cockpit/api/nango/session", { method: "POST", body: "{\"kind\":\"email\"}" }));
      expect(session.status).toBe(200);
      expect(await session.json()).toEqual({ connectLink: "https://connect.nango.dev/x" });
      const imported = await nangoImport();
      expect(await imported.json()).toEqual({ items: [] });
      const hook = await nangoWebhook(
        new Request("http://cockpit/api/nango/webhook", {
          method: "POST",
          body: "{\"success\":false}",
          headers: { "x-nango-hmac-sha256": "abc123" },
        }),
      );
      expect(await hook.json()).toEqual({ ok: true });
      expect(calls.map((row) => row.url)).toEqual([
        `${worker}/nango/status`,
        `${worker}/nango/session`,
        `${worker}/nango/import`,
        `${worker}/nango/webhook`,
      ]);
      const hookCall = calls.find((row) => row.url.endsWith("/nango/webhook"));
      expect(new Headers(hookCall?.init?.headers).get("x-nango-hmac-sha256")).toBe("abc123");
    });
  });

  it("GET /nango/start forwards a 302 connect link", async () => {
    await withWorkerFetch(async () => {
      const res = await nangoStart(new Request("http://cockpit/nango/start?kind=email"));
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://connect.nango.dev/link");
      expect(await res.text()).toBe("");
    });
  });

  it("cockpit webhook rejects oversized bodies before proxying", async () => {
    const orig = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      const res = await nangoWebhook(
        new Request("http://cockpit/api/nango/webhook", {
          method: "POST",
          body: "x".repeat(64 * 1024 + 1),
        }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: { code: "connections.invalid", message: "nango webhook too large" },
      });
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("nango session proxy maps worker-down to 503", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    process.env.STATION_WORKER_URL = "http://127.0.0.1:1";
    try {
      const res = await nangoSession(
        new Request("http://cockpit/api/nango/session", { method: "POST", body: "{\"kind\":\"email\"}" }),
      );
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({
        error: { code: "connections.nango_failed", message: "worker down" },
      });
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("pack activate returns pack.activate_failed when the worker is down", async () => {
    const prevUrl = process.env.STATION_WORKER_URL;
    process.env.STATION_WORKER_URL = "http://127.0.0.1:1";
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    try {
      const res = await packActivate(new Request("http://cockpit/packs/sales/activate", { method: "POST" }), {
        params: Promise.resolve({ id: "sales" }),
      });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: { code: "pack.activate_failed" } });
    } finally {
      globalThis.fetch = orig;
      if (prevUrl === undefined) {
        delete process.env.STATION_WORKER_URL;
      } else {
        process.env.STATION_WORKER_URL = prevUrl;
      }
    }
  });
});
