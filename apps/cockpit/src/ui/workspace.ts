import { stationConfig } from "../lib/station-config.ts";
import { defaultConnectors } from "./connectors.ts";
import { ledgerSentence, needsYou } from "./park-action.ts";
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

export function sourceCaption(row: Connection): string {
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(row.account)) {
    return row.label;
  }
  return row.account;
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
  return live.map((row) => ({
    id: row.id,
    kind: row.kind,
    label: row.label,
    account: row.account,
    detail: row.status,
    status: row.status,
  }));
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

export function kindHasParkQueue(kind: ChannelKind): boolean {
  switch (kind) {
    case "email":
    case "slack":
      return true;
    case "obsidian":
    case "db":
    case "mcp":
      return false;
    default: {
      const _never: never = kind;
      return Boolean(_never);
    }
  }
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

export function activityFromLedger(items: ParkItem[]): ActivityEvent[] {
  const rows: ActivityEvent[] = [];
  for (const item of items) {
    const sentence = ledgerSentence(item, items);
    const phases = runPhases(item, sentence);
    if (phases.length === 0) {
      rows.push({
        id: `decision-${item.id}`,
        at: "2026-01-01T00:00:00Z",
        channel: inferChannel(item),
        account: inferAccount(item),
        action: sentence,
        signalId: item.id,
        detail: item.subject ?? item.body ?? item.id,
      });
      continue;
    }
    for (const phase of phases) {
      rows.push({
        id: `decision-${item.id}-${phase.phase}`,
        at: "2026-01-01T00:00:00Z",
        channel: inferChannel(item),
        account: inferAccount(item),
        action: phase.sentence,
        signalId: item.id,
        detail: item.subject ?? item.body ?? item.id,
        phase: phase.phase,
      });
    }
  }
  return rows;
}

function runPhases(item: ParkItem, sentence: string): Array<{ phase: string; sentence: string }> {
  if (!item.runId) {
    return [];
  }
  if (item.state === "parked") {
    return [
      { phase: "drafted", sentence },
      { phase: "waiting for Approve", sentence },
    ];
  }
  if (item.state === "sent") {
    return [
      { phase: "sent", sentence },
      { phase: "waiting for reply", sentence },
    ];
  }
  return [];
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
  const parked = items.filter(needsYou);
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
