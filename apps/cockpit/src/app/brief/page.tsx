import { loadPark } from "../../lib/worker.ts";
import { BriefView } from "../../ui/BriefView.tsx";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const { items } = await loadPark();
  return <BriefView items={items} />;
}
