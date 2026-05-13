import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { readQaSourceState } from "./qa-git.mjs";

export const QA_EVIDENCE_MANIFEST = "latest-v2-evidence.json";

export function createQaRunId(scenario) {
  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(".", "-");
  const suffix = scenario.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${stamp}-${process.pid}-${randomUUID().slice(0, 8)}-${suffix}`;
}

export function writeLatestRun(qaRunsDir, runDir) {
  fs.mkdirSync(qaRunsDir, { recursive: true });
  fs.writeFileSync(path.join(qaRunsDir, "latest.txt"), runDir, "utf8");
}

export function createQaRun({ rootDir, qaRunsDir, scenario, evidenceTier }) {
  const runId = createQaRunId(scenario);
  const runDir = path.join(qaRunsDir, runId);
  fs.mkdirSync(runDir, { recursive: true });
  writeLatestRun(qaRunsDir, runDir);
  return {
    scenario,
    runId,
    runDir,
    startedAt: new Date().toISOString(),
    sourceState: readQaSourceState(rootDir),
    confidenceLabel: "failed",
    evidenceTier,
    checks: [],
    artifacts: []
  };
}

export function recordQaCheck(run, name, passed, details = {}) {
  run.checks.push({
    name,
    status: passed ? "pass" : "fail",
    details
  });
}

export function recordQaPass(run, name, details = {}) {
  recordQaCheck(run, name, true, details);
}

export function recordQaFail(run, name, details = {}) {
  recordQaCheck(run, name, false, details);
}

export function hasQaFailures(run) {
  return run.checks.some((check) => check.status === "fail");
}

export function finishQaRun(
  { rootDir, qaRunsDir, run },
  { exactClaimAllowed, failureClaim = "No fixed claim allowed.", uncoveredConditions = [] }
) {
  run.finishedAt = new Date().toISOString();
  run.confidenceLabel = hasQaFailures(run) ? "failed" : "automated-pass";
  run.exactClaimAllowed =
    run.confidenceLabel === "automated-pass" ? exactClaimAllowed : failureClaim;
  run.uncoveredConditions = uncoveredConditions;
  run.artifacts.push("summary.json", "report.md");
  fs.writeFileSync(path.join(run.runDir, "summary.json"), JSON.stringify(run, null, 2));
  fs.writeFileSync(path.join(run.runDir, "report.md"), renderQaRunReport(run), "utf8");
  recordQaEvidence(qaRunsDir, run.scenario, run.runDir);
  return {
    runId: run.runId,
    checks: run.checks.length,
    confidenceLabel: run.confidenceLabel,
    report: path.relative(rootDir, path.join(run.runDir, "report.md"))
  };
}

export function recordQaEvidence(qaRunsDir, scenario, runDir) {
  const manifestPath = path.join(qaRunsDir, QA_EVIDENCE_MANIFEST);
  const current = readJson(manifestPath) ?? { scenarios: {} };
  const summary = readJson(path.join(runDir, "summary.json"));
  current.updatedAt = new Date().toISOString();
  current.scenarios = {
    ...(current.scenarios ?? {}),
    [scenario]: {
      runDir,
      runId: path.basename(runDir),
      recordedAt: new Date().toISOString(),
      confidenceLabel: summary?.confidenceLabel,
      sourceState: summary?.sourceState
    }
  };
  writeJsonAtomic(manifestPath, current);
}

function renderQaRunReport(run) {
  const checks = run.checks
    .map((check) => `- ${check.status.toUpperCase()}: ${check.name}`)
    .join("\n");
  const artifacts = Array.from(new Set(run.artifacts))
    .map((artifact) => `- ${artifact}`)
    .join("\n");
  const uncovered = (run.uncoveredConditions ?? [])
    .map((condition) => `- ${condition}`)
    .join("\n");
  return `# Deskagotchi ${run.scenario} QA

Scenario: ${run.scenario}

Run id: ${run.runId}

Confidence: ${run.confidenceLabel}

Evidence tier: ${run.evidenceTier}

## Checks

${checks || "- No checks recorded."}

## Artifacts

${artifacts || "- No artifacts recorded."}

## Exact Claim Allowed

${run.exactClaimAllowed}

## Uncovered Conditions

${uncovered || "- None listed."}
`;
}

export function readQaEvidenceRunDir(qaRunsDir, scenario) {
  const manifest = readJson(path.join(qaRunsDir, QA_EVIDENCE_MANIFEST));
  const runDir = manifest?.scenarios?.[scenario]?.runDir;
  if (typeof runDir !== "string" || runDir.trim().length === 0) {
    return null;
  }
  return path.isAbsolute(runDir) ? runDir : path.join(qaRunsDir, runDir);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}
