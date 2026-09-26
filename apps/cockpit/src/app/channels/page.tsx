import { listLiveConnections, loadPark } from "../../lib/worker.ts";
import { ChannelsIndex } from "../../ui/ChannelsIndex.tsx";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const [{ items }, live] = await Promise.all([loadPark(), listLiveConnections()]);
  return <ChannelsIndex items={items} live={live} />;
}
