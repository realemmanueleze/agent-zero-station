import { startWorker } from "@station/runtime";
import { createLogger } from "@station/observability";

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
