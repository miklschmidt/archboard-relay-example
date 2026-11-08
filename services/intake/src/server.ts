import { createServer, type ServerResponse } from "node:http";
import { acceptParcel } from "./accept.ts";

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function readBody(request: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function startIntake(port: number): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://intake.local");
    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "POST" && url.pathname === "/parcels") {
      try {
        const body = JSON.parse(await readBody(request)) as { parcelId?: string; lane?: string };
        const accepted = await acceptParcel(
          { parcelId: body.parcelId ?? "", lane: body.lane ?? "" },
          { fetch },
        );
        writeJson(response, 202, accepted);
      } catch (error) {
        const message = error instanceof Error ? error.message : "intake failed";
        writeJson(response, 400, { error: message });
      }
      return;
    }
    writeJson(response, 404, { error: "not found" });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("intake failed to bind"));
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
  const port = Number(process.env.PORT ?? "8081");
  startIntake(port).then((intake) => {
    process.stdout.write(`intake listening ${intake.url}\n`);
  });
}
