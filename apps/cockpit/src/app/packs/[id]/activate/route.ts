import { NextResponse } from "next/server";
import { workerFetch } from "../../../../lib/worker.ts";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const res = await workerFetch(`/packs/${encodeURIComponent(id)}/activate`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ error: { code: "pack.activate_failed" } }, { status: 503 });
  }
}
