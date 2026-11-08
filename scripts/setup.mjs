// Find or clone the infrastructure checkout, then register both checkouts with Archboard.
// RELAY_INFRA_DIR overrides the default sibling directory.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const app = resolve(import.meta.dirname, "..");
const infra = resolve(process.env.RELAY_INFRA_DIR ?? `${app}/../archboard-relay-example-infra`);
const infraUrl = "https://github.com/miklschmidt/archboard-relay-example-infra.git";
const archboard = `${app}/node_modules/.bin/archboard`;

function run(command, args) {
  const { status } = spawnSync(command, args, { stdio: ["ignore", "ignore", "inherit"] });
  if (status !== 0) {
    process.exit(status ?? 1);
  }
}

if (!existsSync(infra)) {
  console.log(`cloning ${infraUrl} into ${infra}`);
  run("git", ["clone", infraUrl, infra]);
}
for (const checkout of [app, infra]) {
  run(archboard, ["repo", "add", checkout]);
  console.log(`registered ${checkout}`);
}
