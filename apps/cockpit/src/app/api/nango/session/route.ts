import { NextResponse } from "next/server";
import { workerJson } from "../../../../lib/worker.ts";

export async function POST(req: Request) {
  const body = await req.text();
  const { status, json } = await workerJson("/nango/session", { method: "POST", body });
  return NextResponse.json(json, { status });
}
