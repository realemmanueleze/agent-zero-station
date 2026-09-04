import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const custom = join(process.cwd(), "../../station.theme.css");
  const local = join(process.cwd(), "theme.css");
  const path = existsSync(custom) ? custom : local;
  const css = existsSync(path) ? readFileSync(path, "utf8") : "/* no station.theme.css */\n";
  return new NextResponse(css, {
    headers: { "content-type": "text/css; charset=utf-8" },
  });
}
