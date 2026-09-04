import { describe, expect, it } from "vitest";
import { StationError } from "@station/observability";
import { getStation } from "@station/api";
import { scoringTurnCallsCommitSend } from "@station/loop";

const MASTER = "local-dev-master-key-32-bytes!!!!";
const LEAK = ["imapPass", "smtpPass", "refreshToken", "STATION_MASTER_KEY"];

async function workerJson(
  port: number,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; json: unknown }> {
  const headers = new Headers(init.headers);
  if (!headers.has("authorization")) {
    headers.set("authorization", "Bearer t16");
  }
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as unknown };
}

function pasteBody(account: string) {
  return {
    kind: "email",
    imapHost: "imap.example.com",
    imapUser: account,
    imapPass: "secret-imap",
    smtpHost: "smtp.example.com",
    smtpUser: account,
    smtpPass: "secret-smtp",
  };
}

describe("T16 persist", () => {
  it("same catalog: second station lists the pasted connection without secrets", async () => {
    const catalog = "memory://t16-same";
    const first = getStation({ seed: false });
    first.config.load({ STATION_DATABASE_URL: catalog, STATION_MASTER_KEY: MASTER });
    const a = await first.worker.listen({ host: "127.0.0.1", token: "t16" });
    try {
      const created = await workerJson(a.port, "/connections", {
        method: "POST",
        body: JSON.stringify(pasteBody("live@acme.com")),
      });
      expect(created.status).toBe(200);
    } finally {
      await a.close();
    }

    const second = getStation({ seed: false });
    second.config.load({ STATION_DATABASE_URL: catalog, STATION_MASTER_KEY: MASTER });
    const b = await second.worker.listen({ host: "127.0.0.1", token: "t16" });
    try {
      const listed = await workerJson(b.port, "/connections");
      expect(listed.status).toBe(200);
      const items = (listed.json as { items: Array<{ account: string }> }).items;
      expect(items.some((row) => row.account === "live@acme.com")).toBe(true);
      const raw = JSON.stringify(listed.json);
      for (const leak of LEAK) {
        expect(raw).not.toContain(leak);
      }
    } finally {
      await b.close();
    }
  });

  it("same catalog: parked account is on the second park list", async () => {
    const catalog = "memory://t16-park";
    const first = getStation({ seed: false });
    first.config.load({ STATION_DATABASE_URL: catalog, STATION_MASTER_KEY: MASTER });
    await first.schema.loadFixtureFile("fixtures/demo.jsonl");
    const listed = await first.cockpit.parkList({ host: "127.0.0.1" });
    expect(listed.status).toBe(200);
    const items = (listed.json as { items: Array<{ id: string; state: string }> }).items;
    expect(items.some((row) => row.state === "parked")).toBe(true);

    const second = getStation({ seed: false });
    second.config.load({ STATION_DATABASE_URL: catalog, STATION_MASTER_KEY: MASTER });
    const again = await second.cockpit.parkList({ host: "127.0.0.1" });
    const next = (again.json as { items: Array<{ id: string; state: string }> }).items;
    expect(next.length).toBe(items.length);
    expect(next.some((row) => row.state === "parked")).toBe(true);
  });

  it("different catalogs do not leak connections", async () => {
    const alpha = getStation({ seed: false });
    alpha.config.load({
      STATION_DATABASE_URL: "memory://t16-alpha",
      STATION_MASTER_KEY: MASTER,
    });
    const a = await alpha.worker.listen({ host: "127.0.0.1", token: "t16" });
    try {
      await workerJson(a.port, "/connections", {
        method: "POST",
        body: JSON.stringify(pasteBody("alpha@acme.com")),
      });
    } finally {
      await a.close();
    }

    const beta = getStation({ seed: false });
    beta.config.load({
      STATION_DATABASE_URL: "memory://t16-beta",
      STATION_MASTER_KEY: MASTER,
    });
    const b = await beta.worker.listen({ host: "127.0.0.1", token: "t16" });
    try {
      const listed = await workerJson(b.port, "/connections");
      const items = (listed.json as { items: Array<{ account: string }> }).items;
      expect(items.some((row) => row.account === "alpha@acme.com")).toBe(false);
    } finally {
      await b.close();
    }
  });

  it("no catalog stays instance-local", async () => {
    const first = getStation({ seed: false });
    first.config.load({ STATION_MASTER_KEY: MASTER });
    const a = await first.worker.listen({ host: "127.0.0.1", token: "t16" });
    try {
      await workerJson(a.port, "/connections", {
        method: "POST",
        body: JSON.stringify(pasteBody("ephemeral@acme.com")),
      });
    } finally {
      await a.close();
    }

    const second = getStation({ seed: false });
    second.config.load({ STATION_MASTER_KEY: MASTER });
    const b = await second.worker.listen({ host: "127.0.0.1", token: "t16" });
    try {
      const listed = await workerJson(b.port, "/connections");
      const items = (listed.json as { items: Array<{ account: string }> }).items;
      expect(items.some((row) => row.account === "ephemeral@acme.com")).toBe(false);
    } finally {
      await b.close();
    }
  });

  it("DELETE tombstone survives; Approve is connections.missing", async () => {
    const catalog = "memory://t16-tomb";
    const first = getStation();
    first.config.load({ STATION_DATABASE_URL: catalog, STATION_MASTER_KEY: MASTER });
    const a = await first.worker.listen({ host: "127.0.0.1", token: "t16" });
    try {
      const created = await workerJson(a.port, "/connections", {
        method: "POST",
        body: JSON.stringify(pasteBody("gone@acme.com")),
      });
      const id = (created.json as { id: string }).id;
      await workerJson(a.port, `/connections/${id}`, { method: "DELETE" });
    } finally {
      await a.close();
    }

    const second = getStation({ seed: false });
    second.config.load({ STATION_DATABASE_URL: catalog, STATION_MASTER_KEY: MASTER });
    await expect(second.send.approve("dec-missing-box")).rejects.toBeInstanceOf(StationError);
    await expect(second.send.approve("dec-missing-box")).rejects.toMatchObject({
      code: "connections.missing",
    });
    expect(await second.send.decisionState("dec-missing-box")).toBe("parked");
  });

  it("scoring turn still cannot send", () => {
    expect(scoringTurnCallsCommitSend()).toBe(false);
  });
});
