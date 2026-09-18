import type { ParkItem } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function typedAmount(item: ParkItem): number | undefined {
  return typeof item.amount === "number" ? item.amount : undefined;
}

function channelOf(item: ParkItem): string {
  return item.channel ?? "email";
}

export function renderParkCardHtml(item: ParkItem): string {
  const title = item.subject ?? item.body ?? item.id;
  const amount = typedAmount(item);
  const risk = amount && amount >= 10_000 ? "high" : "normal";
  const why =
    item.rationale ??
    "Fixture park. Approve goes through the worker. The model cannot send.";
  return `<article class="park-card" data-decision="${escapeHtml(item.id)}" data-risk="${risk}" data-channel="${escapeHtml(channelOf(item))}">
  <div class="card-title"><h3>${escapeHtml(title)}</h3>${amount ? `<span class="amount">$${amount.toLocaleString()}</span>` : ""}</div>
  <p class="meta">${escapeHtml(channelOf(item))} · ${escapeHtml(item.packId ?? "sales")} · ${escapeHtml(item.from ?? "unknown")}</p>
  <p class="body">${escapeHtml(item.body ?? "")}</p>
  <p class="why">${escapeHtml(why)}</p>
  <div class="hitl">
    <button type="button" data-action="approve">Approve</button>
    <button type="button" data-action="edit">Edit draft</button>
    <button type="button" data-action="kill">Kill</button>
  </div>
</article>`;
}

export function ParkCard({
  item,
  editing,
  draft,
  onApprove,
  onEdit,
  onChangeDraft,
  onSaveEdit,
  onCancelEdit,
  onKill,
  busy,
}: {
  item: ParkItem;
  editing?: boolean;
  draft?: string;
  onApprove?: (id: string) => void;
  onEdit?: (id: string) => void;
  onChangeDraft?: (value: string) => void;
  onSaveEdit?: (id: string) => void;
  onCancelEdit?: () => void;
  onKill?: (id: string) => void;
  busy?: boolean;
}) {
  const title = item.subject ?? item.body ?? item.id;
  const amount = typedAmount(item);
  const risk = amount && amount >= 10_000 ? "high" : "normal";
  const why =
    item.rationale ??
    "Fixture park. Approve goes through the worker. The model cannot send.";
  return (
    <article className="park-card" tabIndex={0} data-decision={item.id} data-risk={risk} data-channel={channelOf(item)}>
      <div className="card-title">
        <h3>{title}</h3>
        {amount ? <span className="amount">${amount.toLocaleString()}</span> : null}
      </div>
      <p className="meta">
        {channelOf(item)} · {item.packId ?? "sales"} · {item.from ?? "unknown"}
        {item.tenantId ? ` · ${item.tenantId}` : ""}
      </p>
      {editing ? (
        <textarea
          className="draft-edit"
          aria-label="Edit draft"
          value={draft}
          onChange={(event) => onChangeDraft?.(event.target.value)}
          rows={4}
        />
      ) : (
        <p className="body">{item.body}</p>
      )}
      <p className="why">{why}</p>
      <div className="hitl">
        {editing ? (
          <>
            <button type="button" onClick={() => onSaveEdit?.(item.id)}>
              Save draft
            </button>
            <button type="button" className="danger" onClick={onCancelEdit}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => onApprove?.(item.id)}>
              Approve
            </button>
            <button type="button" onClick={() => onEdit?.(item.id)}>
              Edit draft
            </button>
            <button type="button" className="danger" onClick={() => onKill?.(item.id)}>
              Kill
            </button>
          </>
        )}
      </div>
    </article>
  );
}
