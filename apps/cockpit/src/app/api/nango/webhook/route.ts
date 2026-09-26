import { NextResponse } from "next/server";
import { workerJson } from "../../../../lib/worker.ts";

const NANGO_WEBHOOK_MAX_BYTES = 64 * 1024;

export async function POST(req: Request) {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > NANGO_WEBHOOK_MAX_BYTES) {
    return NextResponse.json(
      { error: { code: "connections.invalid", message: "nango webhook too large" } },
      { status: 400 },
    );
  }
  const body = await req.text();
  if (Buffer.byteLength(body, "utf8") > NANGO_WEBHOOK_MAX_BYTES) {
    return NextResponse.json(
      { error: { code: "connections.invalid", message: "nango webhook too large" } },
      { status: 400 },
    );
  }
  const { status, json } = await workerJson("/nango/webhook", {
    method: "POST",
    body,
    headers: { "x-nango-hmac-sha256": req.headers.get("x-nango-hmac-sha256") ?? "" },
  });
  return NextResponse.json(json, { status });
}
