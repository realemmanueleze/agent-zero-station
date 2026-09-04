import { NextResponse } from "next/server";
import { workerFetch } from "../../../../../lib/worker.ts";

type Params = { id: string; action: string };

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { id, action } = await context.params;
  if (action !== "approve" && action !== "edit" && action !== "kill") {
    return NextResponse.json({ error: { code: "invariant.unhandled" } }, { status: 404 });
  }
  const incoming = await request.text();
  const res = await workerFetch(`/park/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    body: incoming || undefined,
  });
  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status });
}
