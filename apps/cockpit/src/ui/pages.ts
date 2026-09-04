import { listPackIds } from "@station/packs";
import type { Mailbox } from "@station/channels";

export function renderAccountsHtml(mailboxes: Mailbox[], token = ""): string {
  const rows = mailboxes
    .map((row) => `<li data-mailbox="${row.id}">${row.transport} — ${row.id}</li>`)
    .join("");
  return `<!doctype html><html><body>
  <h1>Accounts</h1>
  <ul class="accounts">${rows}</ul>
  <p class="note">Append a row in station.config.ts. Each mailbox is a tenant key.</p>
</body></html>`.replaceAll(token, "");
}

export function renderPacksHtml(active: string): string {
  const items = listPackIds()
    .map(
      (id) =>
        `<li><form method="post" action="/packs/${id}/activate"><button type="submit" class="${id === active ? "on" : ""}">pack: ${id}</button></form></li>`,
    )
    .join("");
  return `<!doctype html><html><body>
  <h1>Packs</h1>
  <p>Active: ${active}</p>
  <ul class="packs">${items}</ul>
</body></html>`;
}
