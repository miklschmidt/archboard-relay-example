export interface ParcelRequest {
  parcelId: string;
  lane: string;
}

export interface AcceptedParcel {
  parcelId: string;
  routeCode: string;
  jobId: string;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export interface IntakeDeps {
  fetch: (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<FetchResponse>;
  catalogUrl?: string;
  dispatchJobsUrl?: string;
}

function trimUrl(value: string): string {
  return value.replace(/\/$/u, "");
}

export async function acceptParcel(input: ParcelRequest, deps: IntakeDeps): Promise<AcceptedParcel> {
  if (input.parcelId.trim() === "" || input.lane.trim() === "") {
    throw new Error("parcelId and lane are required");
  }
  const catalogUrl = trimUrl(deps.catalogUrl ?? process.env.CATALOG_URL ?? "");
  if (catalogUrl === "") {
    throw new Error("CATALOG_URL is not set");
  }
  const routeResponse = await deps.fetch(`${catalogUrl}/route-codes?lane=${encodeURIComponent(input.lane)}`);
  if (!routeResponse.ok) {
    throw new Error(`catalog returned ${routeResponse.status} for lane ${input.lane}`);
  }
  const routeBody = (await routeResponse.json()) as { routeCode?: string };
  if (typeof routeBody.routeCode !== "string" || routeBody.routeCode === "") {
    throw new Error("catalog response did not include routeCode");
  }

  const jobsUrl = trimUrl(deps.dispatchJobsUrl ?? process.env.DISPATCH_JOBS_URL ?? "");
  if (jobsUrl === "") {
    throw new Error("DISPATCH_JOBS_URL is not set");
  }

  // gate:break start
  const billingUrl = trimUrl(process.env.BILLING_URL ?? "");
  await deps.fetch(`${billingUrl}/surcharges?routeCode=${encodeURIComponent(routeBody.routeCode)}`);
  // gate:break end
  const queued = await deps.fetch(`${jobsUrl}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parcelId: input.parcelId, routeCode: routeBody.routeCode }),
  });
  if (!queued.ok) {
    throw new Error(`dispatch queue returned ${queued.status}`);
  }
  const queuedBody = (await queued.json()) as { jobId?: string };
  if (typeof queuedBody.jobId !== "string" || queuedBody.jobId === "") {
    throw new Error("dispatch queue response did not include jobId");
  }
  return { parcelId: input.parcelId, routeCode: routeBody.routeCode, jobId: queuedBody.jobId };
}
