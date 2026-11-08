import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export interface DispatchJob {
  jobId: string;
  parcelId: string;
  routeCode: string;
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function startBroker(port: number): Promise<{ url: string; close: () => Promise<void>; jobs: () => DispatchJob[] }> {
  const waiting: DispatchJob[] = [];
  let sequence = 0;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://dispatch-jobs.local");
    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { ok: true, depth: waiting.length });
      return;
    }
    if (request.method === "POST" && url.pathname === "/jobs") {
      const body = JSON.parse(await readBody(request)) as { parcelId?: string; routeCode?: string };
      if (typeof body.parcelId !== "string" || typeof body.routeCode !== "string") {
        writeJson(response, 400, { error: "parcelId and routeCode are required" });
        return;
      }
      sequence += 1;
      const job: DispatchJob = { jobId: `job-${sequence}`, parcelId: body.parcelId, routeCode: body.routeCode };
      waiting.push(job);
      writeJson(response, 202, job);
      return;
    }
    if (request.method === "POST" && url.pathname === "/jobs/next") {
      const job = waiting.shift();
      if (job === undefined) {
        writeJson(response, 204, {});
        return;
      }
      writeJson(response, 200, job);
      return;
    }
    writeJson(response, 404, { error: "not found" });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("broker failed to bind"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        jobs: () => [...waiting],
        close: () => new Promise((done, fail) => server.close((error) => (error ? fail(error) : done()))),
      });
    });
  });
}
