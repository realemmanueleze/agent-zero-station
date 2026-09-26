import { NextResponse } from "next/server";
import { workerJson } from "../../../lib/worker.ts";

export async function GET() {
  const result = await workerJson("/workflows");
  return NextResponse.json(result.json, { status: result.status });
}

export async function POST(req: Request) {
  const body = await req.text();
  const result = await workerJson("/workflows", { method: "POST", body });
  return NextResponse.json(result.json, { status: result.status });
}
