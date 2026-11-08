import { startBilling } from "../services/billing/src/server.ts";
import { startCatalog } from "../services/catalog/src/server.ts";
import { takeJob } from "../services/dispatcher/src/take-job.ts";
import { startIntake } from "../services/intake/src/server.ts";
import { startBroker } from "../services/queue/src/broker.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const catalog = await startCatalog(0);
const broker = await startBroker(0);
const billing = await startBilling(0);
process.env.CATALOG_URL = catalog.url;
process.env.DISPATCH_JOBS_URL = broker.url;
process.env.BILLING_URL = billing.url;
const intake = await startIntake(0);

try {
  const acceptedResponse = await fetch(`${intake.url}/parcels`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parcelId: "parcel-1001", lane: "east" }),
  });
  const accepted = (await acceptedResponse.json()) as {
    parcelId?: string;
    routeCode?: string;
    jobId?: string;
    error?: string;
  };
  assert(acceptedResponse.status === 202, `intake status ${acceptedResponse.status}: ${accepted.error ?? ""}`);
  assert(accepted.parcelId === "parcel-1001", "parcel id was not echoed");
  assert(accepted.routeCode === "HR-EAST-14", `unexpected route code ${accepted.routeCode}`);
  assert(accepted.jobId === "job-1", `unexpected job id ${accepted.jobId}`);
  assert(billing.quotes() === 0, "intake called billing; restore the architecture baseline before smoking");

  const unknown = await fetch(`${intake.url}/parcels`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parcelId: "parcel-1002", lane: "south" }),
  });
  assert(unknown.status === 400, `unknown lane should fail intake, got ${unknown.status}`);

  const taken = await takeJob({ fetch });
  assert(taken !== undefined, "dispatcher found no job");
  assert(taken.parcelId === "parcel-1001", "dispatcher took the wrong parcel");
  assert(taken.routeCode === "HR-EAST-14", "dispatcher lost the route code");
  assert(taken.surchargeCents === 125, `unexpected surcharge ${taken.surchargeCents}`);
  assert(billing.quotes() === 1, "dispatcher did not quote billing exactly once");
  assert((await takeJob({ fetch })) === undefined, "queue was not empty after one take");

  process.stdout.write(
    `smoke ok parcel=${taken.parcelId} route=${taken.routeCode} job=${taken.jobId} surchargeCents=${taken.surchargeCents}\n`,
  );
} finally {
  await intake.close();
  await billing.close();
  await broker.close();
  await catalog.close();
}
