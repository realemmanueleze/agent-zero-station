import { workerRedirect } from "../../../../lib/worker.ts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  return workerRedirect(
    `/oauth/slack/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
  );
}