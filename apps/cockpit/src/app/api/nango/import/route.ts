import { NextResponse } from "next/server";
import { workerJson } from "../../../../lib/worker.ts";

export async function POST() {
  const { status, json } = await workerJson("/nango/import", { method: "POST", body: "{}" });
  return NextResponse.json(json, { status });
}
