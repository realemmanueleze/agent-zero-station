import { loadPark } from "../lib/worker.ts";
import { ActionDeck } from "../ui/ActionDeck.tsx";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { items, workerUp } = await loadPark();
  return <ActionDeck items={items} workerUp={workerUp} />;
}
