export type ParkCard = {
  id: string;
  state: string;
  tenantId?: string;
  packId?: string;
  body?: string;
  from?: string;
  subject?: string;
  amount?: number;
  rationale?: string;
};

export function renderParkPage(items: ParkCard[]): string {
  const parked = items.filter((item) => item.state === "parked");
  const cards = parked
    .map((item) => {
      const title = item.subject ?? item.body ?? item.id;
      const to = item.from ? `to ${escapeHtml(item.from)}` : "";
      const amount =
        item.amount && !title.includes(String(item.amount)) && !title.includes("$")
          ? ` · $${item.amount.toLocaleString()}`
          : "";
      const why =
        item.rationale ??
        "Fixture park. Approve sends through the worker. The model cannot commit_send.";
      return `<article class="card" data-decision="${escapeHtml(item.id)}">
  <header>
    <p class="eyebrow">email · ${escapeHtml(item.packId ?? "sales")}</p>
    <h3>${escapeHtml(title)}${amount}</h3>
    <p class="meta">${to} · tenant ${escapeHtml(item.tenantId ?? "local")}</p>
  </header>
  <p class="body">${escapeHtml(item.body ?? "")}</p>
  <p class="why">${escapeHtml(why)}</p>
  <p class="scores">Score 0.81 close · 0.22 nurture · 0.91 park</p>
  <form class="actions" method="post" action="/park/${encodeURIComponent(item.id)}/approve">
    <button type="submit">approve send</button>
  </form>
  <form class="actions" method="post" action="/park/${encodeURIComponent(item.id)}/edit">
    <input type="text" name="body" value="${escapeHtml(item.body ?? "")}" />
    <button type="submit">edit draft</button>
  </form>
  <form class="actions" method="post" action="/park/${encodeURIComponent(item.id)}/kill">
    <button type="submit" class="danger">kill</button>
  </form>
</article>`;
    })
    .join("\n");

  const inbox = items
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.from ?? "fixture")}</strong> — ${escapeHtml(item.body ?? item.subject ?? item.id)} <em>${escapeHtml(item.state)}</em></li>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Agent Zero — cockpit</title>
  <link rel="stylesheet" href="/tokens.css" />
  <link rel="stylesheet" href="/theme.css" />
</head>
<body>
  <header class="top">
    <h1>Agent Zero — cockpit</h1>
    <nav>
      <a class="pack on" href="/park">pack: sales</a>
      <a class="pack" href="/packs">pack: inbox-triage</a>
    </nav>
    <div class="top-actions">
      <span>replay last 7d</span>
      <a href="/accounts">+ account</a>
    </div>
  </header>
  <main class="grid">
    <aside class="connectors">
      <h2>Connectors</h2>
      <ul>
        <li>gmail — work@acme.com <small>isolated</small></li>
        <li>gmail — founder@acme.com <small>isolated</small></li>
        <li>imap — hello@acme.com <small>just added</small></li>
        <li>slack — acme-hq <small>#inbound</small></li>
        <li>obsidian — vault/acme <small>watching</small></li>
        <li>db — postgres/crm <small>read-only</small></li>
        <li>mcp — 3 servers <small>docs, calendar, github</small></li>
      </ul>
      <p class="note">No cap on email rows. + account appends. Each row is a tenant key.</p>
    </aside>
    <section class="work">
      <h2>Parked — human has to say yes</h2>
      ${cards || "<p class=\"empty\">Nothing parked. Load fixtures/demo.jsonl.</p>"}
      <h2>Inbox (same ledger)</h2>
      <ul class="inbox">${inbox || "<li>No signals yet.</li>"}</ul>
    </section>
    <aside class="loop">
      <h2>Loop</h2>
      <ol>
        <li>signal fixture:demo-1</li>
        <li>candidates nurture, close, park</li>
        <li>policy fixture → park</li>
        <li>HITL interrupt commit_send</li>
        <li>outcome pending human</li>
      </ol>
      <p class="note">Switch pack to inbox-triage and replay. Park queue should change. If it does not, the kit is a lie.</p>
    </aside>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
