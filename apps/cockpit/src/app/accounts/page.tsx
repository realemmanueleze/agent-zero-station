import { stationConfig } from "../../lib/station-config.ts";
import { AccountsDeck } from "../../ui/AccountsDeck.tsx";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return <AccountsDeck mailboxes={stationConfig.email} />;
}
