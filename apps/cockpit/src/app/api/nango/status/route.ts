import { NextResponse } from "next/server";
import { workerJson } from "../../../../lib/worker.ts";

export async function GET() {
  const { status, json } = await workerJson("/nango/status");
  return NextResponse.json(json, { status });
}
