import type { PackId } from "./types.ts";

export type { PackId } from "./types.ts";

export function listPackIds(): PackId[] {
  return ["sales", "inbox-triage", "pack-unseen-engine"];
}
