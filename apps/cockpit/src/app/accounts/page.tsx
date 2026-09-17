import { listLiveConnections, loadPark } from "../../lib/worker.ts";
import { stationConfig } from "../../lib/station-config.ts";
import { AccountsDeck } from "../../ui/AccountsDeck.tsx";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [connections, { workerUp }] = await Promise.all([listLiveConnections(), loadPark()]);
  return (
    <AccountsDeck mailboxes={stationConfig.email} connections={connections} workerUp={workerUp} />
  );
}
