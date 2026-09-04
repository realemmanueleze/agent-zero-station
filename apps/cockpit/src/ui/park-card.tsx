import type { ParkItem } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inferredAmount(item: ParkItem): number | undefined {
  if (item.amount) {
    return item.amount;
  }
  const match = (item.body ?? item.subject ?? "").match(/\$(\d[\d,]*)/);
  return match ? Number(match[1].replaceAll(",", "")) : undefined;
}

export function renderParkCardHtml(item: ParkItem): string {
  const title = item.subject ?? item.body ?? item.id;
  const amount = inferredAmount(item);
  const risk = amount && amount >= 10_000 ? "high" : "normal";
  const why =
    item.rationale ??
    "Fixture park. Approve sends through the worker. The model cannot commit_send.";
  return `<article class="park-card" data-decision="${escapeHtml(item.id)}" data-risk="${risk}">
  <p class="eyebrow">email · ${escapeHtml(item.packId ?? "sales")}</p>
  <h3>${escapeHtml(title)}</h3>
  <p class="meta">to ${escapeHtml(item.from ?? "unknown")} · tenant ${escapeHtml(item.tenantId ?? "local")}</p>
  <p class="body">${escapeHtml(item.body ?? "")}</p>
  <p class="why">${escapeHtml(why)}</p>
  <div class="meters" aria-label="scores">
    <span>close 0.81</span>
    <span>nurture 0.22</span>
    <span>park 0.91</span>
  </div>
  <div class="hitl">
    <button type="button" data-action="approve">Approve send</button>
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
}) {
  const title = item.subject ?? item.body ?? item.id;
  const amount = inferredAmount(item);
  const risk = amount && amount >= 10_000 ? "high" : "normal";
  const why =
    item.rationale ??
    "Fixture park. Approve sends through the worker. The model cannot commit_send.";
  return (
    <article className="park-card" data-decision={item.id} data-risk={risk}>
      <p className="eyebrow">email · {item.packId ?? "sales"}</p>
      <div className="card-title">
        <h3>{title}</h3>
        {amount ? <span className="amount">${amount.toLocaleString()}</span> : null}
      </div>
      <p className="meta">
        from {item.from ?? "unknown"} · tenant {item.tenantId ?? "local"}
      </p>
      {editing ? (
        <textarea
          className="draft-edit"
          value={draft}
          onChange={(event) => onChangeDraft?.(event.target.value)}
          rows={4}
        />
      ) : (
        <p className="body">{item.body}</p>
      )}
      <p className="why">{why}</p>
      <div className="meters" aria-label="scores">
        <span>
          close 0.81
          <i style={{ width: "81%" }} />
        </span>
        <span>
          nurture 0.22
          <i style={{ width: "22%" }} />
        </span>
        <span>
          park 0.91
          <i style={{ width: "91%" }} />
        </span>
      </div>
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
            <button type="button" onClick={() => onApprove?.(item.id)}>
              Approve send
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
