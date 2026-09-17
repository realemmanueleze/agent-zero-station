import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cockpitAccess } from "./lib/cockpit-auth.ts";

export function middleware(req: NextRequest) {
  const gate = cockpitAccess({
    host: req.nextUrl.hostname,
    path: req.nextUrl.pathname,
    providedPassword:
      req.cookies.get("station_cockpit_password")?.value ??
      req.headers.get("x-station-cockpit-password") ??
      "",
    envPassword: process.env.STATION_COCKPIT_PASSWORD,
    clientIp: req.headers.get("x-real-ip") ?? undefined,
    forwardedFor: req.headers.get("x-forwarded-for") ?? undefined,
    forwardedHost: req.headers.get("x-forwarded-host") ?? undefined,
  });
  if (gate === "allow") {
    return NextResponse.next();
  }
  if (gate === "login" && !req.nextUrl.pathname.startsWith("/api/") && req.nextUrl.pathname !== "/nango/start") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.json(
    { error: { code: "auth.cockpit_password", message: "cockpit password required" } },
    { status: 401 },
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|station.theme.css).*)"],
};
