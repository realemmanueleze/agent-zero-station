import { notFound } from "next/navigation";
import { listLiveConnections, loadActivity, loadPark } from "../../../../lib/worker.ts";
import { ConnectionView } from "../../../../ui/ConnectionView.tsx";
import { findConnection, isChannelKind } from "../../../../ui/workspace.ts";

export const dynamic = "force-dynamic";

export default async function ConnectionPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!isChannelKind(kind)) {
    notFound();
  }
  const [live, { items, workerUp }, events] = await Promise.all([
    listLiveConnections(),
    loadPark(),
    loadActivity(),
  ]);
  const connection = findConnection(kind, decodeURIComponent(id), live);
  if (!connection) {
    notFound();
  }
  return (
    <ConnectionView
      kind={kind}
      connection={connection}
      items={items}
      events={events}
      workerUp={workerUp}
    />
  );
}
