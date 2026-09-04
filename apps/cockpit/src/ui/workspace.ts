import { stationConfig } from "../lib/station-config.ts";
import { defaultConnectors } from "./connectors.ts";
import type { ActivityEvent, ChannelKind, Connection, ParkItem } from "./types.ts";

export const channelKinds: ChannelKind[] = ["email", "slack", "obsidian", "db", "mcp"];

export function seedConnections(): Connection[] {
  const email = stationConfig.email.map((row) => ({
    id: row.credentialsKey,
    kind: "email" as const,
    label: `${row.transport} — ${row.id}`,
    account: row.id,
    detail: row.transport,
    status: row.transport === "imap" ? ("added" as const) : ("isolated" as const),
  }));
  const slack = stationConfig.slack.map((row) => ({
    id: row.credentialsKey,
    kind: "slack" as const,
    label: `slack — ${row.id}`,
    account: row.id,
    detail: "#inbound",
    status: "live" as const,
  }));
  const obsidian = stationConfig.obsidian.map((row) => ({
    id: row.id,
    kind: "obsidian" as const,
    label: `obsidian — ${row.id}`,
    account: row.id,
    detail: "watching",
    status: "watching" as const,
  }));
  const db = [
    {
      id: "db-crm",
      kind: "db" as const,
      label: "db — postgres/crm",
      account: stationConfig.db.urlEnv,
      detail: "read-only",
      status: "live" as const,
    },
  ];
  const mcp = stationConfig.mcp.map((row) => ({
    id: `mcp-${row.name}`,
    kind: "mcp" as const,
    label: `mcp — ${row.name}`,
    account: row.name,
    detail: row.command,
    status: "live" as const,
  }));
  return [...email, ...slack, ...obsidian, ...db, ...mcp];
}

export function connections(): Connection[] {
  return seedConnections();
}

export function mergeLiveConnections(
  live: Array<{
    id: string;
    kind: ChannelKind;
    account: string;
    label: string;
    status: Connection["status"];
  }>,
): Connection[] {
  const hidden = new Set(live.map((row) => `${row.kind}|${row.account}`));
  const remaining = seedConnections().filter((row) => !hidden.has(`${row.kind}|${row.account}`));
  const liveRows: Connection[] = live.map((row) => ({
    id: row.id,
    kind: row.kind,
    label: row.label,
    account: row.account,
    detail: row.status,
    status: row.status,
  }));
  return [...liveRows, ...remaining];
}

export function connectionsFor(kind: ChannelKind): Connection[] {
  const listed = connections().filter((row) => row.kind === kind);
  if (listed.length > 0) {
    return listed;
  }
  return defaultConnectors
    .filter((row) => row.kind === kind)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      account: row.label,
      detail: row.detail,
      status: row.status,
    }));
}

export function inferChannel(item: ParkItem): ChannelKind {
  return item.channel ?? "email";
}

export function isChannelKind(value: string): value is ChannelKind {
  return (channelKinds as string[]).includes(value);
}

export function findConnection(
  kind: ChannelKind,
  id: string,
  live: Connection[] = [],
): Connection | undefined {
  return mergeLiveConnections(live)
    .filter((row) => row.kind === kind)
    .find((row) => row.id === id);
}

export function inferAccount(item: ParkItem): string {
  if (item.accountId) {
    return item.accountId;
  }
  const first = stationConfig.email[0]?.id ?? "work@acme.com";
  if (item.tenantId === "tenant-a") {
    return first;
  }
  return first;
}

export function itemsForConnection(items: ParkItem[], kind: ChannelKind, account: string): ParkItem[] {
  return items.filter((item) => {
    const channel = inferChannel(item);
    if (channel !== kind) {
      return false;
    }
    return inferAccount(item) === account || item.accountId === account;
  });
}

export function buildActivity(items: ParkItem[]): ActivityEvent[] {
  const fromItems: ActivityEvent[] = items.map((item) => ({
    id: `decision-${item.id}`,
    at: "2026-01-01T00:00:00Z",
    channel: inferChannel(item),
    account: inferAccount(item),
    action: item.state,
    signalId: item.id,
    detail: item.subject ?? item.body ?? item.id,
  }));
  const seed: ActivityEvent[] = [
    {
      id: "log-slack-1",
      at: "2026-01-01T00:05:00Z",
      channel: "slack",
      account: "acme-hq",
      action: "received",
      signalId: "slack-1",
      detail: "#inbound mentioned a quote follow-up",
    },
    {
      id: "log-obsidian-1",
      at: "2026-01-01T00:06:00Z",
      channel: "obsidian",
      account: "vault/acme",
      action: "watched",
      signalId: "vault-1",
      detail: "notes/northwind.md changed",
    },
    {
      id: "log-db-1",
      at: "2026-01-01T00:07:00Z",
      channel: "db",
      account: "PACK_DATABASE_URL",
      action: "queried",
      signalId: "db-1",
      detail: "packs/sales/queries/open-deals.sql",
    },
    {
      id: "log-mcp-1",
      at: "2026-01-01T00:08:00Z",
      channel: "mcp",
      account: "docs",
      action: "tool",
      signalId: "mcp-1",
      detail: "search_docs northwind seats",
    },
  ];
  return [...fromItems, ...seed].sort((a, b) => a.at.localeCompare(b.at));
}

export function queryWorkspace(
  query: string,
  items: ParkItem[],
  activity: ActivityEvent[],
): { items: ParkItem[]; activity: ActivityEvent[] } {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return { items, activity };
  }
  const hit = (value: string | undefined): boolean => (value ?? "").toLowerCase().includes(needle);
  return {
    items: items.filter(
      (item) =>
        hit(item.subject) || hit(item.body) || hit(item.from) || hit(item.rationale) || hit(item.id),
    ),
    activity: activity.filter(
      (row) => hit(row.detail) || hit(row.account) || hit(row.action) || hit(row.channel),
    ),
  };
}

export function generateBrief(
  items: ParkItem[],
  activity: ActivityEvent[],
  query = "",
): string {
  const parked = items.filter((item) => item.state === "parked");
  const sent = items.filter((item) => item.state === "sent");
  const byChannel = channelKinds
    .map((kind) => {
      const count = activity.filter((row) => row.channel === kind).length;
      return `${kind}: ${count} logged`;
    })
    .join(" · ");
  const matches = queryWorkspace(query, items, activity);
  const matchLine = query
    ? `Query “${query}” hit ${matches.items.length} signals and ${matches.activity.length} log lines.`
    : "No query. Whole workspace.";
  const waiting = parked
    .map((item) => `- ${item.subject ?? item.id} (${inferAccount(item)})`)
    .join("\n");
  return [
    "Workspace brief",
    matchLine,
    `${parked.length} waiting on a human. ${sent.length} already sent.`,
    byChannel,
    waiting || "- Nothing parked.",
    `Last log: ${activity.at(-1)?.detail ?? "none"}`,
  ].join("\n");
}
