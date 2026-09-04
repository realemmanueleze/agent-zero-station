import { mailboxesFromConfig } from "@station/channels";
import { stationConfig } from "../../../../packages/station/src/station-config.ts";
import { AccountsDeck } from "../../ui/AccountsDeck.tsx";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return <AccountsDeck mailboxes={mailboxesFromConfig(stationConfig)} />;
}
