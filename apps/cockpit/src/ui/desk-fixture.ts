import type { PackId } from "@station/packs";
import type { ParkItem } from "./types.ts";

export type DeskFixtureMode = "ok" | "approve-fail" | "network" | "malformed";

export type DeskFixture = {
  items: ParkItem[];
  active: PackId;
  approveCalls: number;
  mode: DeskFixtureMode;
  approveDelayMs: number;
  nangoEnabled: boolean;
};

const seed: ParkItem = {
  id: "park-1",
  state: "parked",
  channel: "email",
  accountId: "one@gmail.com",
  tenantId: "tenant-a",
  packId: "sales",
  from: "ada@northwind.io",
  subject: "Need a quote",
  body: "Can you send twelve seats?",
};

export function createDeskFixture(initial?: Partial<DeskFixture>): DeskFixture {
  return {
    items: initial?.items ? [...initial.items] : [{ ...seed }],
    active: initial?.active ?? "sales",
    approveCalls: initial?.approveCalls ?? 0,
    mode: initial?.mode ?? "ok",
    approveDelayMs: initial?.approveDelayMs ?? 0,
    nangoEnabled: initial?.nangoEnabled ?? false,
  };
}

export async function deskFixtureFetch(
  fixture: DeskFixture,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  if (fixture.mode === "network") {
    throw new TypeError("Failed to fetch");
  }
  if ((url === "/nango/status" || url.endsWith("/nango/status")) && method === "GET") {
    return jsonRes(200, { enabled: fixture.nangoEnabled });
  }
  if ((url === "/connections" || url.endsWith("/connections")) && method === "GET") {
    return jsonRes(200, { items: [] });
  }
  if ((url === "/activity" || url.endsWith("/activity")) && method === "GET") {
    return jsonRes(200, { items: [] });
  }
  if ((url === "/park" || url.endsWith("/park")) && method === "GET") {
    return jsonRes(200, { items: fixture.items });
  }
  if (url.includes("/packs/") && url.endsWith("/activate") && method === "POST") {
    const packId = url.split("/packs/")[1]?.replace("/activate", "") ?? "";
    fixture.active = packId as PackId;
    return jsonRes(200, { packId: fixture.active });
  }
  if (url.endsWith("/packs") && method === "GET") {
    return jsonRes(200, { items: ["sales", "inbox-triage"], active: fixture.active });
  }
  const park = url.match(/\/park\/([^/]+)\/(approve|edit|kill)/);
  if (park) {
    const id = decodeURIComponent(park[1] ?? "");
    const action = park[2];
    const item = fixture.items.find((row) => row.id === id);
    if (!item) {
      return jsonRes(404, { error: { code: "park.missing" } });
    }
    if (action === "approve" && item.state === "sending") {
      return jsonRes(409, { error: { code: "send.in_flight" } });
    }
    if (action === "approve") {
      fixture.approveCalls += 1;
      if (fixture.approveDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, fixture.approveDelayMs));
      }
    }
    if (fixture.mode === "malformed") {
      return new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } });
    }
    if (action === "approve" && fixture.mode === "approve-fail") {
      return jsonRes(502, { error: { code: "send.provider_failed" } });
    }
    if (action === "approve") {
      item.state = "sent";
      return jsonRes(200, { state: "sent" });
    }
    if (action === "kill") {
      item.state = "dropped";
      return jsonRes(200, { state: "dropped" });
    }
    const parsed = init?.body ? (JSON.parse(String(init.body)) as { body?: string }) : {};
    item.body = parsed.body ?? item.body;
    return jsonRes(200, { state: "parked", body: item.body });
  }
  return jsonRes(404, { error: { code: "fixture.missing" } });
}

export function resetDeskFixture(fixture: DeskFixture): void {
  const next = createDeskFixture();
  fixture.items.splice(0, fixture.items.length, ...next.items);
  fixture.active = next.active;
  fixture.approveCalls = 0;
  fixture.mode = "ok";
  fixture.approveDelayMs = 0;
  fixture.nangoEnabled = false;
}

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
