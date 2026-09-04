import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { StationError } from "@station/observability";

function catalogEquals(a: string, b: string): boolean {
  return a.replace(/\/$/, "") === b.replace(/\/$/, "");
}

export type SlackFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

export async function slackPostMessage(
  token: string,
  channel: string,
  text: string,
  fetchImpl: SlackFetch,
): Promise<{ ok: true; channel: string }> {
  const res = await fetchImpl("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });
  const json = (await res.json()) as { ok?: boolean };
  if (res.status >= 400 || json.ok === false) {
    throw new StationError({
      code: "send.provider_failed",
      message: "slack post failed",
    });
  }
  return { ok: true, channel };
}

export function vaultSearch(root: string, needle: string): string[] {
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        walk(path);
        continue;
      }
      const text = readFileSync(path, "utf8");
      if (text.toLowerCase().includes(needle.toLowerCase())) {
        hits.push(path);
      }
    }
  };
  walk(root);
  return hits;
}

const WRITE_SQL = /\b(insert|update|delete|drop|alter|truncate|grant)\b/i;

export function queryPackSql(
  packUrl: string,
  stationUrl: string,
  sql: string,
): { rows: unknown[]; denied?: boolean } {
  if (catalogEquals(packUrl, stationUrl)) {
    throw new StationError({
      code: "config.pack_db_same_as_station",
      message: "pack SQL cannot use the station catalog",
    });
  }
  if (WRITE_SQL.test(sql)) {
    throw new StationError({
      code: "connections.invalid",
      message: "pack SQL is read-only",
    });
  }
  return { rows: [] };
}

export function mcpToolAllowed(name: string): boolean {
  return !/send|mail|post|write/i.test(name);
}
