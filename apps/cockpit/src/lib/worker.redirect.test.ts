import { describe, expect, it } from "vitest";
import { forwardWorkerRedirect, oauthFailureHtml, oauthWorkerRedirect } from "./worker.ts";

describe("workerRedirect error forwarding", () => {
  it("forwards a worker 400 body so the browser is not empty", async () => {
    const res = new Response(
      JSON.stringify({
        error: { code: "connections.invalid", message: "GOOGLE_OAUTH_CLIENT_ID is required" },
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
    const out = await forwardWorkerRedirect(res);
    expect(out.status).toBe(400);
    const text = await out.text();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/GOOGLE_OAUTH_CLIENT_ID is required/);
    expect(text).not.toMatch(/Bearer |STATION_CONTROL_TOKEN/);
  });

  it("keeps 302 empty-bodied with Location only", async () => {
    const dest = "https://accounts.google.com/o/oauth2/v2/auth?client_id=cid";
    const res = new Response(null, { status: 302, headers: { location: dest } });
    const out = await forwardWorkerRedirect(res);
    expect(out.status).toBe(302);
    expect(out.headers.get("location")).toBe(dest);
    expect(await out.text()).toBe("");
  });

  it("escapes HTML and keeps non-JSON or message-less bodies", async () => {
    expect(oauthFailureHtml('<script>alert(1)</script>')).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(oauthFailureHtml('<script>alert(1)</script>')).not.toContain("<script>");
    const raw = await forwardWorkerRedirect(new Response("upstream exploded", { status: 502 }));
    expect(await raw.text()).toMatch(/upstream exploded/);
    const empty = await forwardWorkerRedirect(new Response("", { status: 500 }));
    expect(await empty.text()).toMatch(/worker returned 500/);
    const noMessage = await forwardWorkerRedirect(
      new Response(JSON.stringify({ error: { code: "connections.invalid" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    const text = await noMessage.text();
    expect(text).toMatch(/connections\.invalid/);
    expect(text).not.toMatch(/Bearer |STATION_CONTROL_TOKEN/);
  });

  it("oauthWorkerRedirect 302s to Channels when the worker is down or returns 4xx", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    try {
      const out = await oauthWorkerRedirect("/oauth/google/start");
      expect(out.status).toBe(302);
      expect(out.headers.get("location")).toBe("/channels?connect=error");
    } finally {
      globalThis.fetch = orig;
    }

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: { message: "GOOGLE_OAUTH_CLIENT_ID is required" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    try {
      const out = await oauthWorkerRedirect("/oauth/google/start");
      expect(out.status).toBe(302);
      expect(out.headers.get("location")).toBe("/channels?connect=error");
      expect(await out.text()).toBe("");
    } finally {
      globalThis.fetch = orig;
    }
  });
});
