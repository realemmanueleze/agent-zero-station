import { ParkCard, renderParkCardHtml } from "./park-card.tsx";
import { getParkRenderer } from "./registry.ts";
import type { ParkItem } from "./types.ts";

export function ParkSlot({
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
  const renderer = getParkRenderer(item.packId ?? "sales");
  if (renderer !== renderParkCardHtml) {
    return <div className="park-slot" dangerouslySetInnerHTML={{ __html: renderer(item) }} />;
  }
  return (
    <ParkCard
      item={item}
      editing={editing}
      draft={draft}
      onApprove={onApprove}
      onEdit={onEdit}
      onChangeDraft={onChangeDraft}
      onSaveEdit={onSaveEdit}
      onCancelEdit={onCancelEdit}
      onKill={onKill}
    />
  );
}
