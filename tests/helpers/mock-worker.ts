import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  createDeskFixture,
  deskFixtureFetch,
  type DeskFixture,
} from "../../apps/cockpit/src/ui/desk-fixture.ts";

export type MockWorker = {
  url: string;
  fixture: DeskFixture;
  close: () => Promise<void>;
};

function read(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function startMockWorker(port = 0): Promise<MockWorker> {
  const fixture = createDeskFixture();
  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const body = req.method === "GET" ? undefined : await read(req);
    try {
      const response = await deskFixtureFetch(fixture, url.pathname + url.search, {
        method: req.method,
        body,
      });
      res.writeHead(response.status, {
        "content-type": response.headers.get("content-type") ?? "application/json",
      });
      res.end(await response.text());
    } catch {
      req.socket.destroy();
    }
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const bound = typeof address === "object" && address ? address.port : port;
      resolve({
        url: `http://127.0.0.1:${bound}`,
        fixture,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}
