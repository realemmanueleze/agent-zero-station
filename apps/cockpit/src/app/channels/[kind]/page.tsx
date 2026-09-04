import { notFound } from "next/navigation";
import { listLiveConnections, loadPark } from "../../../lib/worker.ts";
import { ChannelKindView } from "../../../ui/ChannelKindView.tsx";
import { isChannelKind } from "../../../ui/workspace.ts";

export const dynamic = "force-dynamic";

export default async function ChannelKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!isChannelKind(kind)) {
    notFound();
  }
  const [{ items }, live] = await Promise.all([loadPark(), listLiveConnections()]);
  return <ChannelKindView kind={kind} items={items} live={live} />;
}
