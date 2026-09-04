import { loadActivity, loadPark } from "../../lib/worker.ts";
import { ActivityView } from "../../ui/ActivityView.tsx";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const [{ items }, events] = await Promise.all([loadPark(), loadActivity()]);
  return <ActivityView items={items} events={events} />;
}
