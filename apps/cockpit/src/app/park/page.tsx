import { listLiveConnections, loadPark } from "../../lib/worker.ts";
import { ActionDeck } from "../../ui/ActionDeck.tsx";

export const dynamic = "force-dynamic";

export default async function ParkPage() {
  const [{ items, workerUp }, live] = await Promise.all([loadPark(), listLiveConnections()]);
  return <ActionDeck items={items} live={live} workerUp={workerUp} />;
}
