import { describe, expect, it } from "vitest";
import { scoringTurnCallsCommitSend } from "@station/loop";
import { inboundDecisionId } from "../../packages/station/src/email-producer.ts";
import { approveWithConnection, ConnectionStore } from "../../packages/station/src/connections.ts";
import { completeNangoConnection } from "../../packages/station/src/nango.ts";
import {
  parseNangoEnvelope,
  pollNangoAccount,
  sendNangoDraft,
  type NangoFetch,
} from "../../packages/station/src/nango-runtime.ts";

const MASTER = "local-dev-master-key-32-bytes!!!!";
const SECRET = "nango-runtime-secret-do-not-leak";

function env(): Record<string, string | undefined> {
  return { STATION_MASTER_KEY: MASTER, NANGO_SECRET_KEY: SECRET };
}

function upsert(store: ConnectionStore, account: string, connectionId: string, integration: string) {
  return completeNangoConnection({
    store,
    env: env(),
    connectionId,
    integration,
    account,
  });
}

describe("T30 Nango runtime", () => {
  it("polls Gmail through the Nango proxy and never leaks the secret", async () => {
    const seen: string[] = [];
    const fetchImpl: NangoFetch = async (url, init) => {
      seen.push(`${init?.method ?? "GET"} ${url}`);
      expect(init?.headers?.authorization).toBe(`Bearer ${SECRET}`);
      expect(init?.headers?.["connection-id"]).toBe("conn-a");
      expect(init?.headers?.["provider-config-key"]).toBe("google-mail");
      if (url.includes("/messages/") && !url.endsWith("/messages")) {
        return {
          status: 200,
          json: async () => ({
            payload: {
              headers: [
                { name: "From", value: "ada@northwind.io" },
                { name: "Subject", value: "Need a quote" },
              ],
              body: { data: Buffer.from("twelve seats").toString("base64url") },
            },
          }),
        };
      }
      return {
        status: 200,
        json: async () => ({ messages: [{ id: "m1" }] }),
      };
    };
    const inbound = await pollNangoAccount({
      kind: "email",
      account: "one@gmail.com",
      envelope: { provider: "nango", connectionId: "conn-a", integration: "google-mail" },
      env: env(),
      fetchImpl,
    });
    expect(inbound).toHaveLength(1);
    expect(inbound[0]?.account).toBe("one@gmail.com");
    expect(inbound[0]?.from).toBe("ada@northwind.io");
    expect(inbound[0]?.sendTo).toBe("ada@northwind.io");
    expect(inbound[0]?.providerMessageId).toBe("m1");
    expect(inboundDecisionId(inbound[0]!)).toBe("prod-one@gmail.com-m1");
    expect(inboundDecisionId(inbound[0]!)).toBe(inboundDecisionId(inbound[0]!));
    expect(JSON.stringify(inbound)).not.toContain(SECRET);
    expect(seen.some((row) => row.includes("/proxy/gmail/v1/users/me/messages"))).toBe(true);
  });

  it("isolates two Nango accounts on poll and send", async () => {
    const used: string[] = [];
    const fetchImpl: NangoFetch = async (url, init) => {
      used.push(init?.headers?.["connection-id"] ?? "");
      if (url.includes("chat.postMessage") || url.includes("messages/send")) {
        return { status: 200, json: async () => ({ id: "sent-1", ok: true }) };
      }
      if (url.includes("conversations.history") || url.includes("/messages")) {
        return { status: 200, json: async () => ({ messages: [] }) };
      }
      return { status: 200, json: async () => ({ messages: [] }) };
    };
    await pollNangoAccount({
      kind: "email",
      account: "a@gmail.com",
      envelope: { provider: "nango", connectionId: "conn-a", integration: "google-mail" },
      env: env(),
      fetchImpl,
    });
    await pollNangoAccount({
      kind: "slack",
      account: "workspace-b",
      envelope: { provider: "nango", connectionId: "conn-b", integration: "slack" },
      env: env(),
      fetchImpl,
    });
    await sendNangoDraft({
      kind: "email",
      to: "a@gmail.com",
      body: "ok",
      envelope: { provider: "nango", connectionId: "conn-a", integration: "google-mail" },
      env: env(),
      fetchImpl,
    });
    await sendNangoDraft({
      kind: "slack",
      to: "C123",
      body: "ok",
      envelope: { provider: "nango", connectionId: "conn-b", integration: "slack" },
      env: env(),
      fetchImpl,
    });
    expect(used.filter((id) => id === "conn-a").length).toBeGreaterThan(0);
    expect(used.filter((id) => id === "conn-b").length).toBeGreaterThan(0);
    expect(used.includes("conn-a") && used.includes("conn-b")).toBe(true);
    expect(used.every((id) => id === "conn-a" || id === "conn-b")).toBe(true);
  });

  it("failed Nango send stays parked and is send.provider_failed", async () => {
    const store = new ConnectionStore(() => env());
    upsert(store, "live@gmail.com", "conn-live", "google-mail");
    await expect(
      sendNangoDraft({
        kind: "email",
        to: "live@gmail.com",
        body: "draft",
        envelope: { provider: "nango", connectionId: "conn-live", integration: "google-mail" },
        env: env(),
        fetchImpl: async () => ({ status: 502, json: async () => ({ error: "down" }) }),
      }),
    ).rejects.toMatchObject({ code: "send.provider_failed" });
    expect(store.find("email", "live@gmail.com")?.status).toBe("live");
  });

  it("scoring turn still cannot send; Drive is not a live channel", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
    const store = new ConnectionStore(() => env());
    expect(() =>
      completeNangoConnection({
        store,
        env: env(),
        connectionId: "drive-1",
        integration: "google-drive",
        account: "drive@gmail.com",
      }),
    ).toThrow(/not a station channel|drive/i);
  });

  it("store poll and approve use the injected Nango transport", async () => {
    const store = new ConnectionStore(() => env());
    upsert(store, "wired@gmail.com", "conn-wired", "google-mail");
    const used: string[] = [];
    store.setNangoFetch(async (url, init) => {
      used.push(`${init?.headers?.["connection-id"] ?? ""} ${url}`);
      if (url.includes("messages/send")) {
        return { status: 200, json: async () => ({ id: "ok" }) };
      }
      return { status: 200, json: async () => ({ messages: [] }) };
    });
    await expect(store.pollAccount("wired@gmail.com", "email")).resolves.toEqual([]);
    await approveWithConnection(store, { account: "wired@gmail.com", body: "ok", sendTo: "ada@x.com" });
    expect(used.every((row) => row.startsWith("conn-wired "))).toBe(true);
    expect(used.some((row) => row.includes("/proxy/gmail/v1/users/me/messages"))).toBe(true);
    expect(used.some((row) => row.includes("messages/send"))).toBe(true);
  });

  it("parseNangoEnvelope rejects incomplete rows; Gmail list 400 is nango_failed", async () => {
    expect(parseNangoEnvelope({ provider: "smtp", connectionId: "x", integration: "google-mail" })).toBeUndefined();
    expect(parseNangoEnvelope({ provider: "nango", connectionId: "", integration: "google-mail" })).toBeUndefined();
    expect(parseNangoEnvelope({ provider: "nango", connectionId: "c1", integration: "google-mail" })).toEqual({
      provider: "nango",
      connectionId: "c1",
      integration: "google-mail",
    });
    await expect(
      pollNangoAccount({
        kind: "email",
        account: "one@gmail.com",
        envelope: { provider: "nango", connectionId: "conn-a", integration: "google-mail" },
        env: env(),
        fetchImpl: async () => ({ status: 400, json: async () => ({}) }),
      }),
    ).rejects.toMatchObject({ code: "connections.nango_failed" });
    await expect(
      pollNangoAccount({
        kind: "email",
        account: "one@gmail.com",
        envelope: { provider: "nango", connectionId: "conn-a", integration: "google-mail" },
        env: {},
      }),
    ).rejects.toMatchObject({ code: "connections.invalid" });
  });

  it("Gmail poll skips missing ids and 400 gets, then uses snippet", async () => {
    const inbound = await pollNangoAccount({
      kind: "email",
      account: "one@gmail.com",
      envelope: { provider: "nango", connectionId: "conn-a", integration: "google-mail" },
      env: env(),
      fetchImpl: async (url) => {
        if (String(url).includes("m-bad")) {
          return { status: 400, json: async () => ({}) };
        }
        if (String(url).includes("m-ok")) {
          return {
            status: 200,
            json: async () => ({
              payload: { headers: [{ name: "From", value: "ada@x.com" }, { name: "Subject", value: "Hi" }] },
              snippet: "snippet body",
            }),
          };
        }
        return { status: 200, json: async () => ({ messages: [{}, { id: "m-bad" }, { id: "m-ok" }] }) };
      },
    });
    expect(inbound).toHaveLength(1);
    expect(inbound[0]?.body).toBe("snippet body");
    expect(inbound[0]?.from).toBe("ada@x.com");
  });

  it("Slack poll 400 is nango_failed; send uses ts and stays send.provider_failed on 502", async () => {
    await expect(
      pollNangoAccount({
        kind: "slack",
        account: "acme",
        envelope: { provider: "nango", connectionId: "conn-b", integration: "slack" },
        env: { ...env(), NANGO_SLACK_INBOX_CHANNEL: "C-inbox" },
        fetchImpl: async () => ({ status: 503, json: async () => ({}) }),
      }),
    ).rejects.toMatchObject({ code: "connections.nango_failed" });
    const sent = await sendNangoDraft({
      kind: "slack",
      to: "C-inbox",
      body: "ok",
      envelope: { provider: "nango", connectionId: "conn-b", integration: "slack" },
      env: env(),
      fetchImpl: async () => ({ status: 200, json: async () => ({ ts: "123.456" }) }),
    });
    expect(sent.providerId).toBe("123.456");
    await expect(
      sendNangoDraft({
        kind: "slack",
        to: "C-inbox",
        body: "ok",
        envelope: { provider: "nango", connectionId: "conn-b", integration: "slack" },
        env: env(),
        fetchImpl: async () => ({ status: 502, json: async () => ({}) }),
      }),
    ).rejects.toMatchObject({ code: "send.provider_failed" });
  });

  it("live slack without a Nango envelope cannot send", async () => {
    const store = new ConnectionStore(() => env());
    const created = store.paste({
      kind: "slack",
      workspaceId: "acme-token",
      slackToken: "xoxb-test",
      label: "acme-token",
    });
    store.markStatus(created.id, "live");
    await expect(
      approveWithConnection(store, { account: "acme-token", body: "hi", sendTo: "C1" }),
    ).rejects.toMatchObject({ code: "connections.invalid" });
  });

  it("test runtime without an injected Nango fetch still returns fixture inbound", async () => {
    const store = new ConnectionStore(() => env());
    upsert(store, "fixture@gmail.com", "conn-fix", "google-mail");
    const inbound = await store.pollAccount("fixture@gmail.com", "email");
    expect(inbound).toHaveLength(1);
    expect(inbound[0]?.account).toBe("fixture@gmail.com");
  });

  it("Slack poll parks messages with text and send falls back to nango id", async () => {
    const inbound = await pollNangoAccount({
      kind: "slack",
      account: "acme",
      envelope: { provider: "nango", connectionId: "conn-b", integration: "slack" },
      env: { ...env(), NANGO_SLACK_INBOX_CHANNEL: "C-inbox" },
      fetchImpl: async () => ({
        status: 200,
        json: async () => ({
          messages: [{ text: "need twelve seats", user: "U1", ts: "1.1" }, { user: "U2" }],
        }),
      }),
    });
    expect(inbound).toHaveLength(1);
    expect(inbound[0]).toMatchObject({
      kind: "slack",
      account: "acme",
      from: "U1",
      body: "need twelve seats",
      sendTo: "C-inbox",
    });
    const sent = await sendNangoDraft({
      kind: "email",
      to: "ada@x.com",
      body: "ok",
      envelope: { provider: "nango", connectionId: "conn-a", integration: "google-mail" },
      env: env(),
      fetchImpl: async () => ({ status: 200, json: async () => ({}) }),
    });
    expect(sent.providerId).toBe("nango");
    await expect(
      sendNangoDraft({
        kind: "email",
        to: "ada@x.com\r\nBcc: evil@x.com",
        body: "ok",
        envelope: { provider: "nango", connectionId: "conn-a", integration: "google-mail" },
        env: env(),
        fetchImpl: async () => ({ status: 200, json: async () => ({ id: "should-not-send" }) }),
      }),
    ).rejects.toMatchObject({ code: "connections.invalid" });
  });
});
