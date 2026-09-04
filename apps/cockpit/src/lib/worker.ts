import type { ActivityEvent, ChannelKind, Connection, ParkItem } from "../ui/types.ts";

const workerUrl = () => process.env.STATION_WORKER_URL ?? "http://127.0.0.1:19174";
const controlToken = () => process.env.STATION_CONTROL_TOKEN ?? "dev-control-token";

export async function workerRedirect(path: string): Promise<Response> {
  const res = await fetch(`${workerUrl()}${path}`, {
    redirect: "manual",
    headers: { authorization: `Bearer ${controlToken()}` },
    cache: "no-store",
  });
  const headers = new Headers();
  const location = res.headers.get("location");
  if (location) {
    headers.set("location", location);
  }
  return new Response(null, { status: res.status, headers });
}

export async function listLiveConnections(): Promise<Connection[]> {
  try {
    const res = await workerFetch("/connections");
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as { items?: Connection[] };
    return (json.items ?? []).map((row) => ({
      ...row,
      detail: row.detail ?? row.status,
    }));
  } catch {
    return [];
  }
}

export async function workerFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${controlToken()}`);
  headers.set("content-type", headers.get("content-type") ?? "application/json");
  return fetch(`${workerUrl()}${path}`, { ...init, headers, cache: "no-store" });
}

export async function listParkItems(): Promise<ParkItem[]> {
  const loaded = await loadPark();
  return loaded.items;
}

export function mapWorkerActivity(
  rows: Array<{
    id?: string;
    action?: string;
    account?: string;
    detail?: string;
    channel?: string;
    at?: string;
    signalId?: string;
  }>,
): ActivityEvent[] {
  return rows.map((row) => ({
    id: row.id ?? "decision-unknown",
    at: row.at ?? "",
    channel: (row.channel as ChannelKind) ?? "email",
    account: row.account ?? "",
    action: row.action ?? "",
    signalId: row.signalId ?? row.id ?? "",
    detail: row.detail ?? "",
  }));
}

export async function loadActivity(): Promise<ActivityEvent[]> {
  try {
    const res = await workerFetch("/activity");
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as { items?: Parameters<typeof mapWorkerActivity>[0] };
    return mapWorkerActivity(json.items ?? []);
  } catch {
    return [];
  }
}

export async function loadBrief(query = ""): Promise<string> {
  try {
    const path = query ? `/brief?q=${encodeURIComponent(query)}` : "/brief";
    const res = await workerFetch(path);
    if (!res.ok) {
      return "";
    }
    const json = (await res.json()) as { brief?: string };
    return json.brief ?? "";
  } catch {
    return "";
  }
}

export async function loadPark(): Promise<{ items: ParkItem[]; workerUp: boolean }> {
  try {
    const res = await workerFetch("/park");
    if (!res.ok) {
      return { items: [], workerUp: false };
    }
    const json = (await res.json()) as { items?: ParkItem[] };
    return { items: json.items ?? [], workerUp: true };
  } catch {
    return { items: [], workerUp: false };
  }
}
