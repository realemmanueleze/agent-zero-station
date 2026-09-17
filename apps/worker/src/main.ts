import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { startWorker } from "@station/runtime";
import { createLogger } from "@station/observability";

function loadDotEnv(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(join(process.cwd(), ".env"));

const log = createLogger({ service: "worker" }).withContext({ requestId: "boot" });

const runtime = await startWorker({
  controlToken: process.env.STATION_CONTROL_TOKEN ?? "dev-control-token",
  fixturePath: "fixtures/demo.jsonl",
  workerPort: Number(process.env.STATION_WORKER_PORT ?? 19174),
});

log.info("listening", {
  workerPort: String(runtime.workerPort),
});

const shutdown = () => {
  void runtime.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
