import { createHash, randomBytes } from "node:crypto";
import { StationError } from "@station/observability";

const CAP = 64;
const TTL_MS = 10 * 60 * 1000;

type Entry = {
  verifier: string;
  returnPath: string;
  expiresAt: number;
};

export class PkceMap {
  private readonly entries = new Map<string, Entry>();

  start(returnPath = ""): { state: string; verifier: string; challenge: string } {
    if (this.entries.size >= CAP) {
      throw new StationError({
        code: "auth.oauth_state",
        message: "oauth state capacity reached",
      });
    }
    const state = randomBytes(16).toString("hex");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    this.entries.set(state, { verifier, returnPath, expiresAt: Date.now() + TTL_MS });
    return { state, verifier, challenge };
  }

  consume(state: string): { verifier: string; returnPath: string } {
    const entry = this.entries.get(state);
    this.entries.delete(state);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new StationError({
        code: "auth.oauth_state",
        message: "oauth state missing or expired",
      });
    }
    return { verifier: entry.verifier, returnPath: entry.returnPath };
  }
}

export const googlePkce = new PkceMap();
export const slackPkce = new PkceMap();
