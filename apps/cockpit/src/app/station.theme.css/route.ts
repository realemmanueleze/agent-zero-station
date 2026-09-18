import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const custom = join(process.cwd(), "../../station.theme.css");
  const css = existsSync(custom)
    ? readFileSync(custom, "utf8")
    : "/* station.theme.css: optional token overrides at the install root */\n";
  return new NextResponse(css, {
    headers: { "content-type": "text/css; charset=utf-8" },
  });
}
