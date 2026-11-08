import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { knownLanes, routeCode } from "./routes.ts";

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

export function startCatalog(port: number): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://catalog.local");
    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "GET" && url.pathname === "/route-codes") {
      const lane = url.searchParams.get("lane") ?? "";
      const code = routeCode(lane);
      if (code === undefined) {
        writeJson(response, 404, { error: "unknown lane", lanes: knownLanes() });
        return;
      }
      writeJson(response, 200, { lane, routeCode: code });
      return;
    }
    writeJson(response, 404, { error: "not found" });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("catalog failed to bind"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done, fail) => server.close((error) => (error ? fail(error) : done()))),
      });
    });
  });
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("server.ts")) {
  const port = Number(process.env.PORT ?? "8080");
  startCatalog(port).then((catalog) => {
    process.stdout.write(`catalog listening ${catalog.url}\n`);
  });
}
