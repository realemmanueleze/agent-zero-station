import { waitingCount } from "../../ui/park-action.ts";
import { listLiveConnections, loadPark } from "../../lib/worker.ts";
import { AccountsDeck } from "../../ui/AccountsDeck.tsx";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [connections, { items, workerUp }] = await Promise.all([listLiveConnections(), loadPark()]);
  const waiting = waitingCount(items);
  return (
    <AccountsDeck connections={connections} workerUp={workerUp} waiting={waiting} />
  );
}
