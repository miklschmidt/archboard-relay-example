// Prove the gate: the baseline passes, the broken tree fails on a hop that crosses both
// repositories, and the restored tree passes again.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const archboard = `${root}/node_modules/.bin/archboard`;

function gate(command) {
  spawnSync(process.execPath, [`${root}/scripts/gate.mjs`, command], { stdio: "inherit" });
}

function check() {
  const { status, stdout, stderr } = spawnSync(archboard, ["check"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const report = JSON.parse(stdout);
  return { status, stderr, report };
}

function expect(ok, message) {
  if (!ok) {
    throw new Error(message);
  }
}

try {
  gate("restore");
  const baseline = check();
  expect(baseline.status === 0, `baseline check exited ${baseline.status}\n${baseline.stderr}`);
  expect(baseline.report.code.skipped.length === 0, "baseline skipped subjects: run npm run setup");
  console.log("baseline: check exit 0");

  gate("break");
  const broken = check();
  const hop = broken.report.code.findings.find(
    (finding) =>
      finding.code === "RELATIONSHIP_UNDRAWN" &&
      finding.severity === "warning" &&
      new Set(finding.evidence.map((evidence) => evidence.repo)).size === 2,
  );
  expect(broken.status === 1 && hop, `broken check exited ${broken.status} without the cross-repository warning\n${broken.stderr}`);
  console.log("broken: check exit 1, RELATIONSHIP_UNDRAWN with evidence in both repositories");

  gate("restore");
  const restored = check();
  expect(restored.status === 0, `restored check exited ${restored.status}\n${restored.stderr}`);
  console.log("restored: check exit 0");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  gate("restore");
}
