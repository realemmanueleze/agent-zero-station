import { NextResponse } from "next/server";
import { workerFetch } from "../../../lib/worker.ts";

export async function GET() {
  const res = await workerFetch("/connections");
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}

export async function POST(req: Request) {
  const body = await req.text();
  const res = await workerFetch("/connections", { method: "POST", body });
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
