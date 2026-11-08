export interface DispatchJob {
  jobId: string;
  parcelId: string;
  routeCode: string;
}

export interface TakenJob extends DispatchJob {
  surchargeCents: number;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export interface DispatcherDeps {
  fetch: (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<FetchResponse>;
  dispatchJobsUrl?: string;
  billingUrl?: string;
}

function trimUrl(value: string): string {
  return value.replace(/\/$/u, "");
}

export async function takeJob(deps: DispatcherDeps): Promise<TakenJob | undefined> {
  const jobsUrl = trimUrl(deps.dispatchJobsUrl ?? process.env.DISPATCH_JOBS_URL ?? "");
  if (jobsUrl === "") {
    throw new Error("DISPATCH_JOBS_URL is not set");
  }
  const next = await deps.fetch(`${jobsUrl}/jobs/next`, { method: "POST" });
  if (next.status === 204) {
    return undefined;
  }
  if (!next.ok) {
    throw new Error(`dispatch queue returned ${next.status}`);
  }
  const job = (await next.json()) as Partial<DispatchJob>;
  if (typeof job.jobId !== "string" || typeof job.parcelId !== "string" || typeof job.routeCode !== "string") {
    throw new Error("dispatch queue returned an incomplete job");
  }
  const billingUrl = trimUrl(deps.billingUrl ?? process.env.BILLING_URL ?? "");
  if (billingUrl === "") {
    throw new Error("BILLING_URL is not set");
  }
  const quote = await deps.fetch(`${billingUrl}/surcharges?routeCode=${encodeURIComponent(job.routeCode)}`);
  if (!quote.ok) {
    throw new Error(`billing returned ${quote.status}`);
  }
  const quoteBody = (await quote.json()) as { surchargeCents?: number };
  if (typeof quoteBody.surchargeCents !== "number") {
    throw new Error("billing response did not include surchargeCents");
  }
  return { jobId: job.jobId, parcelId: job.parcelId, routeCode: job.routeCode, surchargeCents: quoteBody.surchargeCents };
}
