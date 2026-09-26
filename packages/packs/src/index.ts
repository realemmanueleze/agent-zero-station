import { StationError } from "@station/observability";
import { inboxTriagePack } from "./inbox-triage.ts";
import { salesPack } from "./sales.ts";
import { unseenEnginePack } from "./unseen-engine.ts";
import type { Pack, PackId } from "./types.ts";

export type { Pack, PackId, PackScore, PackSignal } from "./types.ts";
export { listPackIds } from "./catalog.ts";
export { inboxTriagePack, salesPack, unseenEnginePack };

const packs: Record<PackId, Pack> = {
  sales: salesPack,
  "inbox-triage": inboxTriagePack,
  "pack-unseen-engine": unseenEnginePack,
};

export function getPack(id: string): Pack {
  if (id === "sales" || id === "inbox-triage" || id === "pack-unseen-engine") {
    return packs[id];
  }
  throw new StationError({
    code: "pack.unknown",
    message: "unknown pack",
  });
}
