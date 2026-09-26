import { oauthWorkerRedirect } from "../../../../lib/worker.ts";

export async function GET(req: Request) {
  return oauthWorkerRedirect("/oauth/google/start", req);
}
