import { listPackIds, type PackId } from "@station/packs";
import { loadPacks } from "../../lib/worker.ts";
import { PacksDeck } from "../../ui/PacksDeck.tsx";

export const dynamic = "force-dynamic";

function asPackId(value: string): PackId {
  return (listPackIds() as string[]).includes(value) ? (value as PackId) : "sales";
}

export default async function PacksPage() {
  const { active } = await loadPacks();
  return <PacksDeck initialActive={asPackId(active)} />;
}
