import { loadPark } from "../../lib/worker.ts";
import { CockpitDeck } from "../../ui/CockpitDeck.tsx";

export const dynamic = "force-dynamic";

export default async function ParkPage() {
  const { items, workerUp } = await loadPark();
  return <CockpitDeck items={items} workerUp={workerUp} />;
}
