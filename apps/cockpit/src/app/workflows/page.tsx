import { loadPark } from "../../lib/worker.ts";
import { waitingCount } from "../../ui/park-action.ts";
import { WorkflowView } from "../../ui/WorkflowView.tsx";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const { items } = await loadPark();
  return <WorkflowView waiting={waitingCount(items)} />;
}
