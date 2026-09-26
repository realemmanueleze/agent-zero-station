import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const expected = process.env.STATION_COCKPIT_PASSWORD ?? "";
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  if (!expected || password !== expected) {
    return NextResponse.json(
      { error: { code: "auth.cockpit_password", message: "cockpit password required" } },
      { status: 401 },
    );
  }
  const res = NextResponse.redirect(new URL("/park", req.url), 303);
  res.cookies.set("station_cockpit_password", password, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
