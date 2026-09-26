import { NextResponse } from "next/server";
import { workerJson } from "../../../../lib/worker.ts";

export async function POST(req: Request) {
  const body = await req.text();
  const result = await workerJson("/workflows/chat", { method: "POST", body });
  return NextResponse.json(result.json, { status: result.status });
}
