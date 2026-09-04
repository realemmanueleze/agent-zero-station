import { createServer, request as httpRequest } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getStation, type StationApi } from "@station/api";
import { StationError, toClientError } from "@station/observability";
import { renderParkPage, type ParkCard } from "./park-page.ts";

export type StartStationOptions = {
  controlToken?: string;
  fixturePath?: string;
  cockpitPort?: number;
  workerPort?: number;
  env?: Record<string, string | undefined>;
};

export type StationRuntime = {
  station: StationApi;
  cockpitPort: number;
  workerPort: number;
  close: () => Promise<void>;
};

function itemsFromParkList(json: unknown): ParkCard[] {
  if (!json || typeof json !== "object" || !("items" in json)) {
    return [];
  }
  const items = (json as { items: ParkCard[] }).items;
  return Array.isArray(items) ? items : [];
}

function proxyWorker(
  workerPort: number,
  token: string,
  path: string,
  method: string,
  body?: string,
): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port: workerPort,
        path,
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json: unknown = {};
          if (raw) {
            try {
              json = JSON.parse(raw);
            } catch {
              json = { raw };
            }
          }
          resolve({ status: res.statusCode ?? 500, json });
        });
      },
    );
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

export type WorkerRuntime = {
  station: StationApi;
  workerPort: number;
  controlToken: string;
  close: () => Promise<void>;
};

export async function startWorker(
  options: StartStationOptions = {},
): Promise<WorkerRuntime> {
  const token = options.controlToken ?? process.env.STATION_CONTROL_TOKEN ?? "dev-control-token";
  const station = getStation({ seed: false });
  station.config.load({
    ...process.env,
    ...options.env,
    STATION_CONTROL_TOKEN: token,
    STATION_MASTER_KEY:
      options.env?.STATION_MASTER_KEY ??
      process.env.STATION_MASTER_KEY ??
      "dev-master-key-not-for-prod",
  });
  await station.schema.migrate();
  const fixturePath = options.fixturePath ?? join(process.cwd(), "fixtures/demo.jsonl");
  if (existsSync(fixturePath)) {
    await station.schema.loadFixtureFile(fixturePath);
  }

  const worker = await station.worker.listen({
    host: "127.0.0.1",
    token,
    port: options.workerPort ?? 0,
  });

  return {
    station,
    workerPort: worker.port,
    controlToken: token,
    close: () => worker.close(),
  };
}

export async function startStation(
  options: StartStationOptions = {},
): Promise<StationRuntime> {
  const worker = await startWorker(options);
  const { station, controlToken: token, workerPort } = worker;

  const cockpit = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const write = (status: number, body: string, type: string): void => {
        res.statusCode = status;
        res.setHeader("content-type", type);
        res.end(body);
      };
      try {
        if (url.pathname === "/tokens.css") {
          write(
            200,
            readFileSync(join(process.cwd(), "apps/cockpit/tokens.css"), "utf8"),
            "text/css; charset=utf-8",
          );
          return;
        }
        if (url.pathname === "/theme.css") {
          const custom = join(process.cwd(), "station.theme.css");
          const fallback = join(process.cwd(), "apps/cockpit/theme.css");
          const path = existsSync(custom) ? custom : fallback;
          write(200, readFileSync(path, "utf8"), "text/css; charset=utf-8");
          return;
        }
        if (url.pathname === "/park.json") {
          const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
          write(listed.status, JSON.stringify(listed.json), "application/json");
          return;
        }
        const action = url.pathname.match(/^\/park\/([^/]+)\/(approve|edit|kill)$/);
        if (action && req.method === "POST") {
          const decisionId = decodeURIComponent(action[1] ?? "");
          const verb = action[2];
          let body: string | undefined;
          if (verb === "edit") {
            const raw = await readBody(req);
            if (raw.includes("=")) {
              const params = new URLSearchParams(raw);
              body = JSON.stringify({ body: params.get("body") ?? "" });
            } else {
              body = raw;
            }
          }
          const proxied = await proxyWorker(
            workerPort,
            token,
            `/park/${encodeURIComponent(decisionId)}/${verb}`,
            "POST",
            body,
          );
          const accept = String(req.headers.accept ?? "");
          const contentType = String(req.headers["content-type"] ?? "");
          if (accept.includes("text/html") || contentType.includes("form")) {
            res.statusCode = 303;
            res.setHeader("location", "/park");
            res.end();
            return;
          }
          write(proxied.status, JSON.stringify(proxied.json), "application/json");
          return;
        }
        if (url.pathname === "/" || url.pathname === "/park") {
          const listed = await station.cockpit.parkList({ host: "127.0.0.1" });
          write(
            200,
            renderParkPage(itemsFromParkList(listed.json)),
            "text/html; charset=utf-8",
          );
          return;
        }
        write(404, "not found", "text/plain; charset=utf-8");
      } catch (err) {
        const mapped =
          err instanceof StationError
            ? err
            : new StationError({
                code: "invariant.unhandled",
                message: "cockpit failed",
                cause: err,
              });
        write(mapped.status, JSON.stringify(toClientError(mapped)), "application/json");
      }
    })();
  });

  const cockpitPort = await new Promise<number>((resolve) => {
    cockpit.listen({ host: "127.0.0.1", port: options.cockpitPort ?? 0 }, () => {
      const address = cockpit.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });

  return {
    station,
    cockpitPort,
    workerPort,
    close: async () => {
      await worker.close();
      await new Promise<void>((resolve, reject) => {
        cockpit.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

function readBody(req: Parameters<Parameters<typeof createServer>[0]>[0]): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
