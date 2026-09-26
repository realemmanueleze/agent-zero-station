import { renderParkCardHtml } from "./park-card.tsx";
import { needsYou } from "./park-action.ts";
import {
  activityFromLedger,
  channelKinds,
  connectionsFor,
  generateBrief,
  itemsForConnection,
  kindHasParkQueue,
  queryWorkspace,
} from "./workspace.ts";
import type { ChannelKind, ParkItem } from "./types.ts";

export function renderActionHomeHtml(items: ParkItem[]): string {
  const parked = items.filter(needsYou);
  const cards = parked.map((item) => renderParkCardHtml(item)).join("\n");
  const sources = channelKinds
    .map((kind) => `<a class="source" href="/channels/${kind}">${kind}</a>`)
    .join("");
  return `<main class="action-home">
  <nav class="sources">${sources}</nav>
  <section class="needs-you">${cards}</section>
</main>`;
}

export function renderChannelsHtml(): string {
  const rows = channelKinds
    .map((kind) => {
      const count = connectionsFor(kind).length;
      return `<li data-channel="${kind}">${kind} · ${count}</li>`;
    })
    .join("");
  return `<ul class="channels">${rows}</ul>`;
}

export function renderEmailChannelHtml(): string {
  const rows = connectionsFor("email")
    .map((row) => `<li data-mailbox="${row.account}">${row.label}</li>`)
    .join("");
  return `<ul class="mailboxes">${rows}</ul>`;
}

export function renderConnectionHtml(
  kind: ChannelKind,
  account: string,
  items: ParkItem[],
): string {
  const scoped = itemsForConnection(items, kind, account);
  const incoming = scoped
    .map(
      (item) =>
        `<li class="incoming">${item.from ?? item.id}: ${item.body ?? item.subject ?? item.id}</li>`,
    )
    .join("");
  const log = activityFromLedger(items)
    .filter((row) => row.channel === kind && row.account === account)
    .map((row) => `<li class="log">${row.action}: ${row.detail}</li>`)
    .join("");
  const hitl = kindHasParkQueue(kind) ? scoped.map((item) => renderParkCardHtml(item)).join("") : "";
  return `<section class="connection" data-account="${account}">
  <ul class="incoming">${incoming}</ul>
  ${hitl}
  <ul class="log">${log}</ul>
</section>`;
}

export function renderAddSourceHtml(kind: ChannelKind): string {
  const title = kind === "email" ? "Add email" : `Add ${kind}`;
  const signIn =
    kind === "email"
      ? `<a class="quiet-pill" href="/oauth/google/start?return=${encodeURIComponent("/channels/email")}">Sign in with Google</a>
    <p class="mute">Connecting never sends. Approve still owns send.</p>
    <p class="mute">Testing tokens die in 7 days.</p>`
      : kind === "slack"
        ? `<a class="quiet-pill" href="/oauth/slack/start?return=${encodeURIComponent("/channels/slack")}">Sign in with Slack</a>`
        : "";
  const fields =
    kind === "email"
      ? ""
      : kind === "slack"
        ? `<label>Workspace <input name="workspace" /></label>
    <label>Slack token <input name="slack-token" type="password" /></label>`
        : kind === "obsidian"
          ? `<label>Vault path <input name="vault-path" /></label>`
          : kind === "db"
            ? `<label>Database url <input name="db-url" /></label>`
            : `<label>Name <input name="mcp-name" /></label>
    <label>Command <input name="mcp-command" /></label>`;
  const form = fields
    ? `<form>${fields}
      <button type="submit" class="quiet-pill">Add</button>
    </form>`
    : "";
  return `<aside class="add-source" data-kind="${kind}">
    <h3>${title}</h3>
    ${signIn}
    ${form}
  </aside>`;
}

export function briefForQuery(items: ParkItem[], query: string) {
  const activity = activityFromLedger(items);
  return {
    matches: queryWorkspace(query, items, activity),
    brief: generateBrief(items, activity, query),
  };
}
