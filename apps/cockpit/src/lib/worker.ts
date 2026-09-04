import type { ParkItem } from "../ui/types.ts";

const workerUrl = () => process.env.STATION_WORKER_URL ?? "http://127.0.0.1:19174";
const controlToken = () => process.env.STATION_CONTROL_TOKEN ?? "dev-control-token";

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
