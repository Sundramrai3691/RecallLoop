import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = process.argv.indexOf("--in");
const packet = option >= 0 ? process.argv[option + 1] : null;
if (!packet) throw new Error("Use npm run question-bank:activate -- --in <completed-private-packet.json> [--apply].");
const apply = process.argv.includes("--apply");
if (!process.env.npm_execpath) throw new Error("Run this command through npm so the local npm executable can be resolved safely.");
function run(args) { execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, env: process.env, stdio: "inherit", windowsHide: true }); }

run(["run", "question-bank:review:validate", "-w", "server", "--", "--in", path.resolve(packet)]);
if (!apply) {
  console.log("Preflight passed. No review records or publication state were changed. Re-run with --apply to import through the authenticated reviewer workflow, verify coverage, and run isolated integration/E2E checks.");
  process.exit(0);
}

run(["run", "question-bank:review:import", "-w", "server", "--", "--in", path.resolve(packet)]);
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "recallloop-activation-"));
const reportPath = path.join(temporaryDirectory, "activation-report.json");
try {
  run(["run", "question-bank:activation-report", "-w", "server", "--", "--out", reportPath]);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (!report.assessmentBlueprint.complete) throw new Error(`Human decisions were imported, but Rapid Fire is still not eligible: ${report.assessmentBlueprint.missingRequirements.join("; ")}. No learner assessment or test approval was created.`);
  if (!report.distinctVerificationCandidate.assessmentEligible) throw new Error(`Rapid Fire is eligible, but the exact current distinct verification revision ${report.distinctVerificationCandidate.revisionId} is not approved and published. Review it independently before claiming the complete improvement loop.`);
  run(["run", "test:assessment-loop"]);
  console.log("PASS: the imported human-approved HTTP Rapid Fire blueprint is eligible, and the disposable end-to-end assessment-loop checks passed.");
} finally { await rm(temporaryDirectory, { recursive: true, force: true }); }
