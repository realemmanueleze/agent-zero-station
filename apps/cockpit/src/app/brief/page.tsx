import { loadActivity, loadBrief, loadPark } from "../../lib/worker.ts";
import { BriefView } from "../../ui/BriefView.tsx";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const [{ items }, events, initialBrief] = await Promise.all([
    loadPark(),
    loadActivity(),
    loadBrief(),
  ]);
  return <BriefView items={items} events={events} initialBrief={initialBrief} />;
}
