import { workerRedirect } from "../../../../lib/worker.ts";

const RETURN_ALLOW = new Set(["/", "/channels", "/channels/email"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const requested = url.searchParams.get("return") ?? "";
  const allowed =
    RETURN_ALLOW.has(requested) || /^\/channels\/email\/[^/]+$/.test(requested);
  const ret = allowed ? `&return=${encodeURIComponent(requested)}` : "";
  return workerRedirect(
    `/oauth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}${ret}`,
  );
}
