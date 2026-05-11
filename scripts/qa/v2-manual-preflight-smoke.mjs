import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readQaSourceState } from "./qa-git.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = path.join(ROOT_DIR, ".qa-runs");
const RUN_ID = `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}-manual-preflight-smoke`;
const RUN_DIR = path.join(QA_RUNS_DIR, RUN_ID);
const CLOSEOUT_SMOKE_SCRIPT = path.join(ROOT_DIR, "scripts", "qa", "v2-closeout-audit-smoke.mjs");
const PREFLIGHT_SCRIPT = path.join(ROOT_DIR, "scripts", "qa", "v2-manual-preflight.mjs");
const CLOSEOUT_SMOKE_DIR = path.join(QA_RUNS_DIR, "v2-closeout-audit-smoke");
const CLOSEOUT_SMOKE_QA_RUNS_DIR = path.join(CLOSEOUT_SMOKE_DIR, "qa-runs");
const COMPLETE_MANUAL_PATH = path.join(CLOSEOUT_SMOKE_DIR, "manual-complete.json");

function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const checks = [];

  const closeoutSmoke = spawnSync("node", [CLOSEOUT_SMOKE_SCRIPT], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (closeoutSmoke.status !== 0) {
    throw new Error(
      `Closeout smoke fixture setup failed with ${closeoutSmoke.status}: ${closeoutSmoke.stderr}`
    );
  }
  recordPass(checks, "closeout smoke fixture setup passed");

  const missingManualRun = runPreflight(path.join(CLOSEOUT_SMOKE_DIR, "missing-manual.json"));
  if (missingManualRun.status !== 1) {
    throw new Error(
      `Expected missing manual preflight to fail, got ${missingManualRun.status}.`
    );
  }
  if (missingManualRun.parsed.blockerCount !== 19) {
    throw new Error(
      `Expected 19 missing-manual blockers, got ${missingManualRun.parsed.blockerCount}.`
    );
  }
  if (missingManualRun.parsed.blockerBatchCount !== 6) {
    throw new Error(
      `Expected 6 missing-manual blocker batches, got ${missingManualRun.parsed.blockerBatchCount}.`
    );
  }
  recordPass(checks, "manual preflight fails without manual evidence", {
    blockerCount: missingManualRun.parsed.blockerCount,
    blockerBatchCount: missingManualRun.parsed.blockerBatchCount
  });

  const completeManualRun = runPreflight(COMPLETE_MANUAL_PATH);
  if (completeManualRun.status !== 0) {
    throw new Error(
      `Expected complete manual preflight to pass, got ${completeManualRun.status}.`
    );
  }
  if (completeManualRun.parsed.blockerCount !== 0) {
    throw new Error(
      `Expected zero complete-manual blockers, got ${completeManualRun.parsed.blockerCount}.`
    );
  }
  recordPass(checks, "manual preflight passes with complete manual evidence", {
    blockerCount: completeManualRun.parsed.blockerCount
  });

  writeRunArtifacts({ startedAt, checks });
  console.log(
    JSON.stringify(
      {
        runId: RUN_ID,
        checks: checks.length,
        confidenceLabel: "automated-pass",
        report: path.relative(ROOT_DIR, path.join(RUN_DIR, "report.md"))
      },
      null,
      2
    )
  );
}

function runPreflight(manualPath) {
  const result = spawnSync("node", [PREFLIGHT_SCRIPT, "--manual", manualPath], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DESKAGOTCHI_QA_RUNS_DIR: CLOSEOUT_SMOKE_QA_RUNS_DIR
    },
    encoding: "utf8",
    stdio: "pipe"
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    parsed: parseStdoutJson(result.stdout)
  };
}

function parseStdoutJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Manual preflight stdout was not JSON: ${
        error instanceof Error ? error.message : String(error)
      }\n${stdout}`,
      { cause: error }
    );
  }
}

function recordPass(checks, name, details = {}) {
  checks.push({
    name,
    status: "pass",
    details
  });
}

function writeRunArtifacts({ startedAt, checks }) {
  const summary = {
    scenario: "manual-preflight-smoke",
    runId: RUN_ID,
    startedAt,
    finishedAt: new Date().toISOString(),
    sourceState: readQaSourceState(ROOT_DIR),
    confidenceLabel: "automated-pass",
    evidenceTier: "script-smoke",
    checks,
    artifacts: ["summary.json", "report.md"],
    exactClaimAllowed:
      "manual preflight passed missing-manual and complete-manual fixture checks",
    uncoveredConditions: [
      "real physical manual gate execution remains separate from this preflight smoke"
    ]
  };
  fs.writeFileSync(path.join(RUN_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(RUN_DIR, "report.md"), renderReport(summary), "utf8");
}

function renderReport(summary) {
  const checks = summary.checks
    .map((check) => `- ${check.status.toUpperCase()}: ${check.name}`)
    .join("\n");
  return `# Deskagotchi Manual Preflight Smoke

Run ID: ${summary.runId}

Confidence: ${summary.confidenceLabel}

Evidence tier: ${summary.evidenceTier}

Exact claim allowed: ${summary.exactClaimAllowed}

## Checks

${checks}

## Artifacts

${summary.artifacts.map((artifact) => `- ${artifact}`).join("\n")}

## Uncovered Conditions

${summary.uncoveredConditions.map((condition) => `- ${condition}`).join("\n")}
`;
}

main();
