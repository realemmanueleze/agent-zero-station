import { loadPark } from "../../lib/worker.ts";
import { ActivityView } from "../../ui/ActivityView.tsx";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { items } = await loadPark();
  return <ActivityView items={items} />;
}
