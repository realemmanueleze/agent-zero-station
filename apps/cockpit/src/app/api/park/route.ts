import { NextResponse } from "next/server";
import { listParkItems } from "../../../lib/worker.ts";

export async function GET() {
  const items = await listParkItems();
  return NextResponse.json({ items });
}
