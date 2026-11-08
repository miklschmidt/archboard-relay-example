import { createServer, type ServerResponse } from "node:http";
import { quoteSurcharge } from "./quote.ts";

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

export function startBilling(port: number): Promise<{ url: string; close: () => Promise<void>; quotes: () => number }> {
  let quotes = 0;
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://billing.local");
    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "GET" && url.pathname === "/surcharges") {
      quotes += 1;
      const routeCode = url.searchParams.get("routeCode") ?? "";
      const surchargeCents = quoteSurcharge(routeCode);
      if (surchargeCents === undefined) {
        writeJson(response, 404, { error: "unknown route" });
        return;
      }
      writeJson(response, 200, { routeCode, surchargeCents });
      return;
    }
    writeJson(response, 404, { error: "not found" });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("billing failed to bind"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        quotes: () => quotes,
        close: () => new Promise((done, fail) => server.close((error) => (error ? fail(error) : done()))),
      });
    });
  });
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("server.ts")) {
  const port = Number(process.env.PORT ?? "8082");
  startBilling(port).then((billing) => {
    process.stdout.write(`billing listening ${billing.url}\n`);
  });
}
