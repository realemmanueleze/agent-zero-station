import { workerRedirect } from "../../../lib/worker.ts";

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") ?? "email";
  return workerRedirect(`/nango/start?kind=${encodeURIComponent(kind)}`);
}
