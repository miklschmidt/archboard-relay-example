// Break or restore the rule "Intake does not call Billing", in the application repo only.
// usage: node scripts/gate.mjs break | restore | status
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../services/intake/src/accept.ts", import.meta.url);
const start = "  // gate:break start\n";
const end = "  // gate:break end\n";
const anchor = "  const queued = await deps.fetch(";
const violation = `${start}  const billingUrl = trimUrl(process.env.BILLING_URL ?? "");
  await deps.fetch(\`\${billingUrl}/surcharges?routeCode=\${encodeURIComponent(routeBody.routeCode)}\`);
${end}`;

const text = readFileSync(file, "utf8");
const broken = text.includes(start);
const command = process.argv[2];

if (command === "status") {
  console.log(broken ? "broken: Intake reads BILLING_URL" : "baseline");
  process.exit(broken ? 1 : 0);
} else if (command === "break") {
  if (!broken) {
    writeFileSync(file, text.replace(anchor, violation + anchor));
  }
  console.log("broken: Intake reads BILLING_URL and calls Billing");
} else if (command === "restore") {
  if (broken) {
    writeFileSync(file, text.slice(0, text.indexOf(start)) + text.slice(text.indexOf(end) + end.length));
  }
  console.log("baseline");
} else {
  console.error("usage: node scripts/gate.mjs break | restore | status");
  process.exit(2);
}
