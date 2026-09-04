import { workerRedirect } from "../../../../lib/worker.ts";

export async function GET() {
  return workerRedirect("/oauth/slack/start");
}
