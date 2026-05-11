import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readQaSourceState } from "./qa-git.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = path.join(ROOT_DIR, ".qa-runs");
const SMOKE_WORK_DIR = path.join(QA_RUNS_DIR, "v2-manual-context-smoke");
const SMOKE_EVIDENCE_DIR = path.join(SMOKE_WORK_DIR, "qa-runs");
const MANUAL_CONTEXT_SCRIPT = path.join(ROOT_DIR, "scripts", "qa", "v2-manual-context.mjs");
const RUN_ID = `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}-manual-context-smoke`;
const RUN_DIR = path.join(QA_RUNS_DIR, RUN_ID);
const REQUIRED_SUFFIXES = [
  "launch",
  "drag",
  "overlay",
  "play",
  "lifecycle",
  "renderer",
  "idle",
  "release",
  "check",
  "assets-pets",
  "assets-items",
  "manual-page",
  "visual-page",
  "v2-scope"
];

function main() {
  fs.rmSync(SMOKE_WORK_DIR, { recursive: true, force: true });
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const checks = [];
  const artifacts = [];

  const missingEvidenceRun = runManualContext();
  if (missingEvidenceRun.status !== 1) {
    throw new Error(
      `Expected missing automated evidence to fail, got ${missingEvidenceRun.status}.`
    );
  }
  const missingSummary = readManualContextSummary(missingEvidenceRun);
  const missingQaCheck = missingSummary.checks.find(
    (check) => check.name === "latest QA run references collected"
  );
  assertArrayEquals(
    missingQaCheck.details.missingRuns,
    REQUIRED_SUFFIXES,
    "missing automated evidence list"
  );
  recordPass(checks, "manual context fails without complete automated evidence", {
    missingRuns: missingQaCheck.details.missingRuns
  });

  fs.rmSync(SMOKE_EVIDENCE_DIR, { recursive: true, force: true });
  fs.mkdirSync(SMOKE_EVIDENCE_DIR, { recursive: true });
  for (const suffix of REQUIRED_SUFFIXES) {
    writeAutomatedRunFixture(suffix);
  }

  const completeEvidenceRun = runManualContext();
  if (completeEvidenceRun.status !== 0) {
    throw new Error(
      `Expected complete automated evidence to pass, got ${completeEvidenceRun.status}.`
    );
  }
  const completeSummary = readManualContextSummary(completeEvidenceRun);
  const completeQaCheck = completeSummary.checks.find(
    (check) => check.name === "latest QA run references collected"
  );
  assertArrayEquals(
    completeQaCheck.details.missingRuns,
    [],
    "complete evidence missing run list"
  );
  assertArrayEquals(
    completeQaCheck.details.nonPassingRuns,
    [],
    "complete evidence non-passing run list"
  );
  recordPass(checks, "manual context passes with complete automated evidence", {
    foundRuns: completeQaCheck.details.foundRuns,
    expectedRuns: completeQaCheck.details.expectedRuns
  });

  const completeReport = fs.readFileSync(
    path.join(ROOT_DIR, completeEvidenceRun.parsed.report),
    "utf8"
  );
  for (const suffix of ["check", "assets-pets", "assets-items"]) {
    if (!completeReport.includes(`| ${suffix} |`)) {
      throw new Error(`Manual context report did not include ${suffix}.`);
    }
  }
  recordPass(checks, "manual context report includes code and asset evidence");

  writeRunArtifacts({
    startedAt,
    checks,
    artifacts
  });
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

function runManualContext() {
  const result = spawnSync("node", [MANUAL_CONTEXT_SCRIPT], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DESKAGOTCHI_QA_RUNS_DIR: SMOKE_EVIDENCE_DIR
    },
    encoding: "utf8",
    stdio: "pipe"
  });
  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    parsed: parseStdoutJson(result.stdout)
  };
}

function readManualContextSummary(run) {
  if (run.parsed.summary === undefined) {
    throw new Error(`Manual context run did not print a summary path: ${run.stdout}`);
  }
  return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, run.parsed.summary), "utf8"));
}

function parseStdoutJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Manual context stdout was not JSON: ${
        error instanceof Error ? error.message : String(error)
      }\n${stdout}`,
      { cause: error }
    );
  }
}

function writeAutomatedRunFixture(suffix) {
  const runId = `9999-12-31T23-58-59Z-${suffix}`;
  const runDir = path.join(SMOKE_EVIDENCE_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });
  const summary = {
    scenario: suffix,
    runId,
    startedAt: "9999-12-31T23:58:00.000Z",
    sourceState: readQaSourceState(ROOT_DIR),
    confidenceLabel: "automated-pass",
    evidenceTier: "manual-context-smoke-fixture",
    checks: [
      {
        name: `${suffix} fixture passed`,
        status: "pass",
        details: {}
      }
    ],
    artifacts: ["summary.json", "report.md"],
    finishedAt: "9999-12-31T23:58:30.000Z",
    exactClaimAllowed: `manual-context smoke fixture for ${suffix}`,
    uncoveredConditions: []
  };
  fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(runDir, "report.md"), `# ${suffix} smoke fixture\n`);
}

function assertArrayEquals(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${label}: expected ${expectedJson}, got ${actualJson}`);
  }
}

function recordPass(checks, name, details = {}) {
  checks.push({
    name,
    status: "pass",
    details
  });
}

function writeRunArtifacts({ startedAt, checks, artifacts }) {
  const summary = {
    scenario: "manual-context-smoke",
    runId: RUN_ID,
    startedAt,
    sourceState: readQaSourceState(ROOT_DIR),
    confidenceLabel: "automated-pass",
    evidenceTier: "script-smoke",
    checks,
    artifacts: [...artifacts, "summary.json", "report.md"],
    finishedAt: new Date().toISOString(),
    exactClaimAllowed:
      "manual acceptance context guard passed missing-evidence and complete-evidence smoke checks",
    uncoveredConditions: [
      "real physical manual gate execution remains separate from this guard smoke"
    ]
  };
  fs.writeFileSync(path.join(RUN_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(RUN_DIR, "report.md"), renderReport(summary), "utf8");
}

function renderReport(summary) {
  const checks = summary.checks
    .map((check) => `- ${check.status.toUpperCase()}: ${check.name}`)
    .join("\n");
  const artifacts = summary.artifacts
    .map((artifact) => `- ${artifact}`)
    .join("\n");
  return `# Deskagotchi Manual Context Smoke

Run ID: ${summary.runId}

Confidence: ${summary.confidenceLabel}

Evidence tier: ${summary.evidenceTier}

Exact claim allowed: ${summary.exactClaimAllowed}

## Checks

${checks}

## Artifacts

${artifacts}

## Uncovered Conditions

${summary.uncoveredConditions.map((condition) => `- ${condition}`).join("\n")}
`;
}

main();
