# Harbor Relay

Harbor Relay is a fictional parcel desk for a ferry operator. It is an example for
[Archboard](https://github.com/miklschmidt/archboard), a tool that keeps an architecture model next to the code
and checks the code against it. Nothing here is a real carrier, cluster or cloud account.

The system has four services:

- **Intake** accepts a parcel over HTTP, asks **Catalog** for a route code, and puts one job on a queue.
- **Dispatcher** takes the job from the queue and asks **Billing** for a surcharge.
- Intake must never call Billing. The model says so, and `archboard check` enforces it.

![Break the rule, watch the check fail, restore it](docs/clips/gate.gif)

## Two repositories

The code is here. The Kubernetes manifests and the OpenTofu queue module are in
[archboard-relay-example-infra](https://github.com/miklschmidt/archboard-relay-example-infra),
the way a platform team often keeps them apart from the services.
The architecture model lives in this repository, in `.archboard/vault`. Its history, with the proposal "Parcel intake",
is on the branch `archboard-history` of this repository. A fresh clone fetches it with the other branches
(`archboard model proposals` lists it). It binds each module to a file in one of the two:

| Module | What it does | Bound to | In |
| --- | --- | --- | --- |
| Intake | Public HTTP entry | `Deployment/intake` | infra |
| Accept parcel | `POST /parcels` | `acceptParcel` in `services/intake/src/accept.ts` | this repo |
| Catalog | Route-code lookup | `Deployment/catalog` | infra |
| Route table | Lane to route code | `routeCode` in `services/catalog/src/routes.ts` | this repo |
| Dispatch jobs | Address of the queue | `Service/dispatch-jobs` | infra |
| Queue contract | Retention and visibility | `aws_sqs_queue.dispatch_jobs` in `infra/queue.tf` | infra |
| Dispatcher | Quotes a taken job | `Deployment/dispatcher` | infra |
| Take job | One receive | `takeJob` in `services/dispatcher/src/take-job.ts` | this repo |
| Billing | Surcharge quotes | `Deployment/billing` | infra |
| Rate card | Prefix to cents | `quoteSurcharge` in `services/billing/src/quote.ts` | this repo |

A binding is a repository identity, a path and a symbol. Archboard derives the identity from `origin`:
`github.com/miklschmidt/archboard-relay-example` for this repository and
`github.com/miklschmidt/archboard-relay-example-infra` for the other. No binding stores a path on your machine.
Each checkout tells Archboard where it lives with `archboard repo add`, which `npm run setup` runs for you.

Each relationship is drawn on the part that sends:

- Accept parcel to Route table, over HTTP.
- Accept parcel to Queue contract, over the queue.
- Take job to Queue contract, over the queue.
- Take job to Rate card, over HTTP.

Intake has no relationship to Billing.

<img src="docs/architecture/harbor-relay.svg" alt="Intake and Dispatcher above Catalog, Dispatch jobs and Billing" width="720">

`docs/architecture/` also holds the sequence of the flow "Accept a parcel". Archboard drew both pictures.
Redraw them with:

```bash
npx archboard model render --out docs/architecture/harbor-relay.svg
npx archboard model render --flow "Accept a parcel" --grammar sequence --out docs/architecture/accept-a-parcel.svg
npx archboard model rasterize --scale 2 --out docs/architecture/harbor-relay.png
npx archboard model rasterize --flow "Accept a parcel" --grammar sequence --scale 2 --out docs/architecture/accept-a-parcel.png
```

SVG needs no browser. PNG needs Chromium or Chrome. `npx archboard check embeds` tests that the pictures still match the model.

## Quick start

You need Node.js 22.18 or newer and Git. Linux x64 or arm64, or macOS on Apple silicon.

```bash
git clone https://github.com/miklschmidt/archboard-relay-example
git clone https://github.com/miklschmidt/archboard-relay-example-infra
cd archboard-relay-example
npm ci
npm run setup
npm run check
```

`npm ci` installs the pinned `@archboard/cli@0.1.0`. This repository does not build Archboard.
`npm run setup` registers both checkouts with Archboard. It looks for the infrastructure checkout in
`../archboard-relay-example-infra`. If that directory is missing, it clones the repository from GitHub.
Set `RELAY_INFRA_DIR` to use another directory.
`npm run check` runs `archboard check` and exits 0 on the baseline. It prints only the diagnostics.
The full JSON report goes to stdout, and the script drops it.

Run the setup before you trust a pass. Without it, the check cannot read the infrastructure files.
It skips those modules, says so on stderr (`repository-unregistered`), and still exits 0.

`npm run smoke` starts Catalog, the queue broker, Billing and Intake on `127.0.0.1`, posts a parcel and takes the job.
It calls no cloud API and pulls no image. When Intake calls Billing, it fails.

## Break the rule

```bash
npm run gate:break
npm run check
```

`gate:break` edits one file in this repository, `services/intake/src/accept.ts`. `acceptParcel` now reads
`process.env.BILLING_URL` and calls it. The infrastructure repository is not touched. The check exits 1 with a warning:

```text
warning: RELATIONSHIP_UNDRAWN: ZvzEpjXR.module.json: module "Rate card": The code of "Accept parcel" reaches "Rate card". No relationship joins these modules. ...
  configured-path, resolved, services/intake/src/accept.ts:51
  configured-path, resolved, deploy/kubernetes/peer-endpoints.yaml:13
```

Each evidence line is one end of the hop. The first is in this repository. The second is in the infrastructure repository.
Restore the baseline with:

```bash
npm run gate:restore
npm run check
```

`npm run gate:status` prints `baseline` or `broken`. `npm run gate:self-test` runs the whole sequence: baseline exit 0,
broken exit 1 with a warning whose evidence sits in both repositories, restored exit 0.

## What the check matches across the hop

The platform team publishes every peer address in the ConfigMap `peer-endpoints`. Intake and Dispatcher load it with
`envFrom`. Intake already receives `BILLING_URL`, but its code never reads that name. On the baseline there is no hop,
and the check has nothing to report.

When `acceptParcel` reads `process.env.BILLING_URL`, the check joins two facts:

1. The code reads the name `BILLING_URL`. This end is in the application repository.
2. The ConfigMap sets that name to the address of the Billing Service. This end is in the infrastructure repository.

Both ends must declare the connection. The check follows `envFrom` to the ConfigMap, so a ConfigMap entry
that no code reads gives no hop. A literal `env` entry on a Deployment is different. It counts as evidence for the module
bound to that Deployment, with or without a code read, so the platform uses `envFrom` here.
A match on the name alone is only information, and information never fails the check.
The check does not run `tofu` or `kubectl`. It does not read state or `*.tfvars`, and it never plans or applies.
The report lists what it skipped, for example `repository-unregistered`.

A pull request that changes only this repository can still fail the check. The infrastructure side of the hop is already
in the `main` branch of the infrastructure repository.

## CI and the pre-push hook

- `.github/workflows/architecture.yml` runs on every pull request and on pushes to `main`. Two jobs run apart, so a
  failing smoke test never stops the check. `smoke` runs the smoke test. `check` checks out this repository into `app/`
  and the infrastructure repository into `platform/`, then runs the Archboard check action with `fail-on: warning`.
- `.github/workflows/pull-request.yml` uses the Archboard pull-request action to describe the architecture change of a pull request.
- `.githooks/pre-push` runs the same `archboard check`. When it exits 1, the hook blocks the push.
  `npm install` sets `core.hooksPath` to `.githooks` inside a Git checkout. To skip the hook once, use `git push --no-verify`.

Neither workflow applies infrastructure or needs a credential.

## Documentation

- Archboard: <https://github.com/miklschmidt/archboard>
- Archboard docs: <https://miklschmidt.github.io/archboard/docs/>
- The infrastructure repository: <https://github.com/miklschmidt/archboard-relay-example-infra>
- The clip comes from `docs/clips/gate.tape`. Render it with [VHS](https://github.com/charmbracelet/vhs):
  `vhs docs/clips/gate.tape`, after `npm ci` and `npm run setup`.
