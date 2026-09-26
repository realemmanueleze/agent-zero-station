import { loadPark } from "../../lib/worker.ts";
import { waitingCount } from "../../ui/park-action.ts";
import { StationShell } from "../../ui/StationShell.tsx";
import { renderPrivacyHtml } from "../../ui/privacy.ts";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const { items } = await loadPark();
  const waiting = waitingCount(items);
  return (
    <StationShell title="Privacy" waiting={waiting}>
      <div className="privacy-copy" dangerouslySetInnerHTML={{ __html: renderPrivacyHtml() }} />
    </StationShell>
  );
}
