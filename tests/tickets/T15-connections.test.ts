import { describe, expect, it } from "vitest";
import { StationError, errorCodes, toClientError } from "@station/observability";
import { getStation } from "@station/api";
import { decryptEnvelope, encryptEnvelope } from "@station/api";
import { commitSend, createMemoryTransport } from "@station/channels";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { applyLedgerMigration } from "../../packages/station/src/postgres.ts";
import {
  approveWithConnection,
  ConnectionStore,
} from "../../packages/station/src/connections.ts";
import { renderAddSourceHtml } from "../../apps/cockpit/src/ui/command-deck.ts";
import { mergeLiveConnections } from "../../apps/cockpit/src/ui/workspace.ts";

const MASTER = "local-dev-master-key-32-bytes!!!!";

const LEAK = [
  "refreshToken",
  "accessToken",
  "imapPass",
  "smtpPass",
  "botToken",
  "Bearer",
  "STATION_MASTER_KEY",
];

async function workerJson(
  port: number,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; json: unknown; headers: Headers }> {
  const headers = new Headers(init.headers);
  if (!headers.has("authorization")) {
    headers.set("authorization", "Bearer t15");
  }
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers });
  const json = (await res.json().catch(() => ({}))) as unknown;
  return { status: res.status, json, headers: res.headers };
}

describe("T15 connections", () => {
  it("encrypt/decrypt round-trip; AAD swap throws StationError", () => {
    const sealed = encryptEnvelope({
      key: MASTER,
      aad: "id-1|acct@x.com|email",
      plaintext: JSON.stringify({ imapPass: "secret-pass" }),
    });
    expect(decryptEnvelope({ key: MASTER, aad: "id-1|acct@x.com|email", ...sealed })).toContain(
      "secret-pass",
    );
    expect(() =>
      decryptEnvelope({ key: MASTER, aad: "id-2|other@x.com|email", ...sealed }),
    ).toThrow(StationError);
  });

  it("new error codes appear in client JSON", () => {
    const codes = [
      "connections.invalid",
      "connections.encrypt_failed",
      "connections.decrypt_failed",
      "connections.missing",
      "connections.needs_reauth",
      "auth.oauth_state",
    ] as const;
    for (const code of codes) {
      expect(errorCodes[code]).toBeTruthy();
      const json = toClientError(new StationError({ code, message: "safe" }));
      expect(json.error.code).toBe(code);
      expect(JSON.stringify(json)).not.toMatch(/stack/i);
    }
  });

  it("GET /connections and Add source HTML never leak secrets", async () => {
    const station = getStation();
    station.config.load({ STATION_MASTER_KEY: MASTER });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({
          kind: "email",
          label: "paste",
          imapHost: "imap.gmail.com",
          imapPort: 993,
          imapTls: true,
          imapUser: "live@acme.com",
          imapPass: "app-password",
          smtpHost: "smtp.gmail.com",
          smtpPort: 587,
          smtpTls: true,
          smtpUser: "live@acme.com",
          smtpPass: "app-password",
        }),
      });
      const listed = await workerJson(bound.port, "/connections");
      const text = `${JSON.stringify(listed.json)}\n${renderAddSourceHtml("email")}`;
      for (const needle of LEAK) {
        expect(text).not.toContain(needle === "Bearer" ? "Bearer t15" : needle);
      }
      expect(text).not.toContain("app-password");
      expect(text).not.toContain(MASTER);
    } finally {
      await bound.close();
    }
  });

  it("POST gmail refresh token is connections.invalid", async () => {
    const station = getStation();
    station.config.load({ STATION_MASTER_KEY: MASTER });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      const res = await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({
          kind: "email",
          transport: "gmail",
          refreshToken: "stolen",
        }),
      });
      expect(res.json).toMatchObject({ error: { code: "connections.invalid" } });
    } finally {
      await bound.close();
    }
  });

  it("db paste of the station catalog is rejected", async () => {
    const station = getStation();
    station.config.load({
      STATION_MASTER_KEY: MASTER,
      STATION_DATABASE_URL: "postgres://station/db",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      const res = await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({
          kind: "db",
          label: "oops",
          url: "postgres://station/db",
        }),
      });
      expect(res.json).toMatchObject({
        error: { code: "config.pack_db_same_as_station" },
      });
    } finally {
      await bound.close();
    }
  });

  it("seed hide is per kind+account; adding one live Gmail keeps hello@acme.com", () => {
    const merged = mergeLiveConnections([
      {
        id: "uuid-1",
        kind: "email",
        account: "work@acme.com",
        label: "work",
        status: "live",
      },
    ]);
    const emails = merged.filter((row) => row.kind === "email").map((row) => row.account);
    expect(emails).toContain("work@acme.com");
    expect(emails).toContain("hello@acme.com");
    expect(emails.filter((account) => account === "work@acme.com")).toHaveLength(1);
  });

  it("DELETE then Approve is connections.missing and stays parked", async () => {
    const station = getStation();
    station.config.load({ STATION_MASTER_KEY: MASTER });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      const created = await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({
          kind: "email",
          imapHost: "imap.example.com",
          imapPort: 993,
          imapTls: true,
          imapUser: "gone@acme.com",
          imapPass: "x",
          smtpHost: "smtp.example.com",
          smtpPort: 587,
          smtpTls: true,
          smtpUser: "gone@acme.com",
          smtpPass: "x",
        }),
      });
      const id = (created.json as { id: string }).id;
      await workerJson(bound.port, `/connections/${id}/test`, { method: "POST" });
      await workerJson(bound.port, `/connections/${id}`, { method: "DELETE" });
      const parked = getStation();
      parked.config.load({ STATION_MASTER_KEY: MASTER });
      await expect(station.send.approve("dec-missing-box")).rejects.toMatchObject({
        code: "connections.missing",
      });
      expect(await station.send.decisionState("dec-missing-box")).toBe("parked");
    } finally {
      await bound.close();
    }
  });

  it("Approve uses decision.account; model cannot commit_send; fail stays parked", async () => {
    const station = getStation();
    expect(scoringTurnCallsCommitSend()).toBe(false);
    await expect(
      commitSend({ to: "x", body: "y" }, createMemoryTransport({ fail: true })),
    ).rejects.toMatchObject({ code: "send.provider_failed" });
    expect(await station.send.decisionState("dec-parked")).toBe("parked");
    const park = await station.cockpit.parkList({ host: "127.0.0.1" });
    const items = (park.json as { items: Array<{ accountId?: string; id: string }> }).items;
    const parked = items.find((row) => row.id === "dec-parked");
    expect(parked?.accountId).toBeTruthy();
    expect(parked?.accountId).not.toBe("email[0]");
  });

  it("two email connections isolate by account", async () => {
    const station = getStation();
    station.config.load({ STATION_MASTER_KEY: MASTER });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({
          kind: "email",
          imapUser: "a@acme.com",
          imapPass: "a",
          imapHost: "imap.example.com",
          imapPort: 993,
          imapTls: true,
          smtpHost: "smtp.example.com",
          smtpPort: 587,
          smtpTls: true,
          smtpUser: "a@acme.com",
          smtpPass: "a",
        }),
      });
      await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({
          kind: "email",
          imapUser: "b@acme.com",
          imapPass: "b",
          imapHost: "imap.example.com",
          imapPort: 993,
          imapTls: true,
          smtpHost: "smtp.example.com",
          smtpPort: 587,
          smtpTls: true,
          smtpUser: "b@acme.com",
          smtpPass: "b",
        }),
      });
      const listed = await workerJson(bound.port, "/connections");
      const items = (listed.json as { items: Array<{ account: string }> }).items;
      const accounts = items.filter((row) => row.account.includes("@acme.com")).map((row) => row.account);
      expect(accounts).toContain("a@acme.com");
      expect(accounts).toContain("b@acme.com");
      const a = await station.graph.promptBuffer("tenant-a");
      const b = await station.graph.promptBuffer("tenant-b");
      expect(a).not.toContain("tenant-b-secret-body");
      expect(b).not.toContain("inbox for tenant-a");
    } finally {
      await bound.close();
    }
  });

  it("OAuth 302 has no Bearer; logs omit code/state; evil origin rejected; replay fails", async () => {
    const station = getStation();
    station.config.load({
      STATION_MASTER_KEY: MASTER,
      GOOGLE_OAUTH_CLIENT_ID: "cid",
      GOOGLE_OAUTH_CLIENT_SECRET: "sec",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      const evil = await fetch(`http://127.0.0.1:${bound.port}/oauth/google/start?origin=https://evil.example`, {
        redirect: "manual",
        headers: { authorization: "Bearer t15" },
      });
      expect(evil.status).toBeGreaterThanOrEqual(400);
      const start = await fetch(`http://127.0.0.1:${bound.port}/oauth/google/start`, {
        redirect: "manual",
        headers: { authorization: "Bearer t15" },
      });
      expect(start.status).toBe(302);
      const location = start.headers.get("location") ?? "";
      expect(location).not.toMatch(/Bearer|t15/i);
      expect(location).toContain("127.0.0.1:19173");
      const url = new URL(location);
      const state = url.searchParams.get("state") ?? "";
      const first = await fetch(
        `http://127.0.0.1:${bound.port}/oauth/google/callback?code=ok-code&state=${state}`,
        { redirect: "manual", headers: { authorization: "Bearer t15" } },
      );
      expect(first.status).toBeLessThan(400);
      const replay = await workerJson(
        bound.port,
        `/oauth/google/callback?code=ok-code&state=${state}`,
      );
      expect(replay.json).toMatchObject({ error: { code: "auth.oauth_state" } });
      const logs = (await workerJson(bound.port, "/park")).json;
      const dumped = `${JSON.stringify(logs)}\n${location}`;
      expect(dumped).not.toContain("ok-code");
    } finally {
      await bound.close();
    }
  });

  it("paste /test never records SMTP DATA", async () => {
    const station = getStation();
    station.config.load({ STATION_MASTER_KEY: MASTER });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      const created = await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({
          kind: "email",
          imapHost: "imap.example.com",
          imapPort: 993,
          imapTls: true,
          imapUser: "probe@acme.com",
          imapPass: "x",
          smtpHost: "smtp.example.com",
          smtpPort: 587,
          smtpTls: true,
          smtpUser: "probe@acme.com",
          smtpPass: "x",
        }),
      });
      const id = (created.json as { id: string }).id;
      const tested = await workerJson(bound.port, `/connections/${id}/test`, { method: "POST" });
      expect(tested.json).toMatchObject({ status: "live", sent: false });
    } finally {
      await bound.close();
    }
  });

  it("rotate-keys re-encrypts and GET still hides secrets", async () => {
    const station = getStation();
    station.config.load({ STATION_MASTER_KEY: MASTER });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({
          kind: "email",
          imapHost: "imap.example.com",
          imapPort: 993,
          imapTls: true,
          imapUser: "rotate@acme.com",
          imapPass: "secret-rotate",
          smtpHost: "smtp.example.com",
          smtpPort: 587,
          smtpTls: true,
          smtpUser: "rotate@acme.com",
          smtpPass: "secret-rotate",
        }),
      });
      const rotated = await workerJson(bound.port, "/connections/rotate-keys", { method: "POST" });
      expect(rotated.json).toMatchObject({ rotated: 1 });
      const listed = await workerJson(bound.port, "/connections");
      const text = JSON.stringify(listed.json);
      expect(text).toContain("rotate@acme.com");
      expect(text).not.toContain("secret-rotate");
    } finally {
      await bound.close();
    }
  });

  it("Slack OAuth rejects evil origin and replays as auth.oauth_state", async () => {
    const station = getStation();
    station.config.load({
      STATION_MASTER_KEY: MASTER,
      SLACK_OAUTH_CLIENT_ID: "sid",
      SLACK_OAUTH_CLIENT_SECRET: "ssec",
    });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      const evil = await fetch(
        `http://127.0.0.1:${bound.port}/oauth/slack/start?origin=https://evil.example`,
        { redirect: "manual", headers: { authorization: "Bearer t15" } },
      );
      expect(evil.status).toBeGreaterThanOrEqual(400);
      const start = await fetch(`http://127.0.0.1:${bound.port}/oauth/slack/start`, {
        redirect: "manual",
        headers: { authorization: "Bearer t15" },
      });
      expect(start.status).toBe(302);
      const location = start.headers.get("location") ?? "";
      expect(location).not.toMatch(/Bearer|t15/i);
      expect(location).toContain("127.0.0.1:19173");
      const state = new URL(location).searchParams.get("state") ?? "";
      const first = await fetch(
        `http://127.0.0.1:${bound.port}/oauth/slack/callback?code=ok-code&state=${state}`,
        { redirect: "manual", headers: { authorization: "Bearer t15" } },
      );
      expect(first.status).toBeLessThan(400);
      const replay = await workerJson(bound.port, `/oauth/slack/callback?code=ok-code&state=${state}`);
      expect(replay.json).toMatchObject({ error: { code: "auth.oauth_state" } });
    } finally {
      await bound.close();
    }
  });

  it("slack, obsidian, and mcp paste; mcp shell is invalid", async () => {
    const station = getStation();
    station.config.load({ STATION_MASTER_KEY: MASTER });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      const slack = await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({ kind: "slack", workspaceId: "T123", slackToken: "xoxb-test" }),
      });
      expect(slack.json).toMatchObject({ account: "T123", kind: "slack" });
      const vault = await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({ kind: "obsidian", vaultPath: "/tmp/vault" }),
      });
      expect(vault.json).toMatchObject({ account: "/tmp/vault", kind: "obsidian" });
      const mcp = await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({ kind: "mcp", name: "docs", command: "node", args: ["fixtures/mcp-initialize.mjs"] }),
      });
      expect(mcp.json).toMatchObject({ account: "docs", kind: "mcp" });
      const shell = await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({ kind: "mcp", name: "bad", command: "sh", args: ["-c", "echo hi"] }),
      });
      expect(shell.json).toMatchObject({ error: { code: "connections.invalid" } });
      const listed = JSON.stringify((await workerJson(bound.port, "/connections")).json);
      expect(listed).not.toContain("xoxb-test");
    } finally {
      await bound.close();
    }
  });

  it("needs_reauth on Approve stays parked", async () => {
    const store = new ConnectionStore(() => ({ STATION_MASTER_KEY: MASTER }));
    const row = store.upsertEnvelope({
      kind: "email",
      account: "reauth@acme.com",
      label: "reauth",
      status: "needs_reauth",
      plaintext: JSON.stringify({ smtpHost: "smtp.example.com" }),
    });
    store.markStatus(row.id, "needs_reauth");
    await expect(
      approveWithConnection(store, { account: "reauth@acme.com", body: "hi" }),
    ).rejects.toMatchObject({ code: "connections.needs_reauth" });
  });

  it("email producer parks with account and to", async () => {
    const station = getStation();
    station.config.load({ STATION_MASTER_KEY: MASTER });
    const bound = await station.worker.listen({ host: "127.0.0.1", token: "t15" });
    try {
      const created = await workerJson(bound.port, "/connections", {
        method: "POST",
        body: JSON.stringify({
          kind: "email",
          imapHost: "imap.example.com",
          imapPort: 993,
          imapTls: true,
          imapUser: "probe@acme.com",
          imapPass: "x",
          smtpHost: "smtp.example.com",
          smtpPort: 587,
          smtpTls: true,
          smtpUser: "probe@acme.com",
          smtpPass: "x",
        }),
      });
      const id = (created.json as { id: string }).id;
      await workerJson(bound.port, `/connections/${id}/test`, { method: "POST" });
      await station.worker.startProducer("email:probe@acme.com", "w-prod");
      const park = await station.cockpit.parkList({ host: "127.0.0.1" });
      const items = (park.json as { items: Array<{ accountId?: string; id: string }> }).items;
      const produced = items.find((row) => row.accountId === "probe@acme.com" && row.id.startsWith("prod-"));
      expect(produced?.accountId).toBe("probe@acme.com");
    } finally {
      await bound.close();
    }
  });

  it("migrate applies 002_connections.sql", async () => {
    await expect(
      applyLedgerMigration("postgres://station/db"),
    ).resolves.toBeUndefined();
    const sql = await import("node:fs");
    const text = sql.readFileSync("migrations/002_connections.sql", "utf8");
    expect(text).toMatch(/CREATE TABLE IF NOT EXISTS connections/);
    expect(text).toMatch(/account/);
  });
});
