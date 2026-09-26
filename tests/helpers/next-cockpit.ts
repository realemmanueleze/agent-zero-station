import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";

export type NextCockpit = {
  url: string;
  close: () => Promise<void>;
};

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on("error", reject);
  });
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status < 500) {
        return;
      }
      last = `status ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : "down";
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`next cockpit did not start at ${url}: ${last}`);
}

function stopChild(child: ChildProcess): void {
  if (!child.pid) {
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

export async function startNextCockpit(workerUrl: string): Promise<NextCockpit> {
  const port = await freePort();
  const child: ChildProcess = spawn(
    "pnpm",
    ["--filter", "@station/cockpit", "exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        STATION_WORKER_URL: workerUrl,
        STATION_CONTROL_TOKEN: "desk-mock-token",
        STATION_COCKPIT_PORT: String(port),
        NEXT_DIST_DIR: ".next-t31",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  const url = `http://127.0.0.1:${port}`;
  try {
    await waitForHttp(url, 90_000);
  } catch (err) {
    stopChild(child);
    throw err;
  }
  return {
    url,
    close: async () => {
      stopChild(child);
    },
  };
}
