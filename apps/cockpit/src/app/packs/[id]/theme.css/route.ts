import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const path = join(process.cwd(), "../../packs", id, "theme.css");
  const css = existsSync(path)
    ? readFileSync(path, "utf8")
    : "/* pack theme: accent only. Do not hide Approve, Edit, or Kill. */\n";
  return new NextResponse(css, {
    headers: { "content-type": "text/css; charset=utf-8" },
  });
}
