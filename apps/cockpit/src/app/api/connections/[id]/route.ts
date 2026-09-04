import { NextResponse } from "next/server";
import { workerFetch } from "../../../../lib/worker.ts";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const res = await workerFetch(`/connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
