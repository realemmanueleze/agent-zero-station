import { loadPark } from "../../lib/worker.ts";
import { StationShell } from "../../ui/StationShell.tsx";
import { renderPrivacyHtml } from "../../ui/privacy.ts";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const { items } = await loadPark();
  const waiting = items.filter((item) => item.state === "parked").length;
  return (
    <StationShell title="Privacy" waiting={waiting}>
      <div className="privacy-copy" dangerouslySetInnerHTML={{ __html: renderPrivacyHtml() }} />
    </StationShell>
  );
}
