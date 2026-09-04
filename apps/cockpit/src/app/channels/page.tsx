import { loadPark } from "../../lib/worker.ts";
import { ChannelsIndex } from "../../ui/ChannelsIndex.tsx";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const { items } = await loadPark();
  return <ChannelsIndex items={items} />;
}
