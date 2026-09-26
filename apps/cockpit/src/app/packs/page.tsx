import { listPackIds, type PackId } from "@station/packs";
import { loadPacks, loadPark } from "../../lib/worker.ts";
import { waitingCount } from "../../ui/park-action.ts";
import { PacksDeck } from "../../ui/PacksDeck.tsx";

export const dynamic = "force-dynamic";

function asPackId(value: string): PackId {
  return (listPackIds() as string[]).includes(value) ? (value as PackId) : "sales";
}

export default async function PacksPage() {
  const [{ active }, { items }] = await Promise.all([loadPacks(), loadPark()]);
  const waiting = waitingCount(items);
  return <PacksDeck initialActive={asPackId(active)} waiting={waiting} />;
}
