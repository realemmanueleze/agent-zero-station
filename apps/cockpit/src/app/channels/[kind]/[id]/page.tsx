import { notFound } from "next/navigation";
import { listLiveConnections, loadPark } from "../../../../lib/worker.ts";
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
  const live = await listLiveConnections();
  const connection = findConnection(kind, decodeURIComponent(id), live);
  if (!connection) {
    notFound();
  }
  const { items, workerUp } = await loadPark();
  return (
    <ConnectionView kind={kind} connection={connection} items={items} workerUp={workerUp} />
  );
}
