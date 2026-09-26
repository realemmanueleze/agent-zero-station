import { oauthWorkerRedirect } from "../../../lib/worker.ts";

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") ?? "email";
  return oauthWorkerRedirect(`/nango/start?kind=${encodeURIComponent(kind)}`, req);
}
