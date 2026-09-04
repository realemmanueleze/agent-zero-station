import { StationShell } from "../../ui/StationShell.tsx";
import { renderPrivacyHtml } from "../../ui/privacy.ts";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <StationShell title="Privacy">
      <div dangerouslySetInnerHTML={{ __html: renderPrivacyHtml() }} />
    </StationShell>
  );
}
