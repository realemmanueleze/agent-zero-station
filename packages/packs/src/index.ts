import { inboxTriagePack } from "./inbox-triage.ts";
import { salesPack } from "./sales.ts";
import type { Pack, PackId } from "./types.ts";

export type { Pack, PackId, PackScore, PackSignal } from "./types.ts";
export { inboxTriagePack, salesPack };

const packs: Record<PackId, Pack> = {
  sales: salesPack,
  "inbox-triage": inboxTriagePack,
};

export function getPack(id: string): Pack {
  if (id === "sales" || id === "inbox-triage") {
    return packs[id];
  }
  return salesPack;
}

export function listPackIds(): PackId[] {
  return ["sales", "inbox-triage"];
}
