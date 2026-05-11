import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readQaSourceState } from "./qa-git.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_ROOT = path.join(ROOT_DIR, ".qa-runs");
const SCENARIO = "v2-scope";
const FORBIDDEN_HATCH_SURFACE_PATTERN =
  /\b(Hatch|hatch|CreateDraft|createDraft|GeneratePet|generatePet)\b/;

const SURFACE_FILES = [
  ["src/shared/ipc.ts", "IPC contract has no Hatch generation channel"],
  ["src/preload/index.ts", "preload bridge exposes no Hatch generation method"],
  ["src/main/index.ts", "main process registers no Hatch IPC handler"],
  ["src/renderer/src/App.tsx", "renderer router has no Hatch panel route"],
  ["src/renderer/src/components/PanelApp.tsx", "management panel has no Hatch tab"],
  ["src/renderer/src/components/OverlayApp.tsx", "overlay has no Hatch action"]
];

const REQUIRED_DOC_SNIPPETS = [
  [
    "README.md",
    "Hatch/custom pet generation is deferred for V2",
    "README marks Hatch/custom generation deferred for V2"
  ],
  [
    "README.md",
    "User-facing Hatch/custom pet generation is archived for the V2 release path.",
    "README archives user-facing Hatch for the V2 release path"
  ],
  [
    "docs/qa/deskagotchi-v2-roadmap.html",
    "Custom pet generation is archived",
    "V2 roadmap archives custom pet generation"
  ],
  [
    "docs/v2-goal-success-criteria.md",
    "User-facing custom pet generation is not part of the V2 promise.",
    "V2 success criteria exclude user-facing custom generation"
  ]
];

function main() {
  const run = createRun();

  for (const [relativePath, checkName] of SURFACE_FILES) {
    assertNoHatchSurface(run, relativePath, checkName);
  }

  for (const [relativePath, snippet, checkName] of REQUIRED_DOC_SNIPPETS) {
    assertSnippet(run, relativePath, snippet, checkName);
  }

  finishRun(run);
  if (run.checks.some((check) => check.status === "fail")) {
    process.exit(1);
  }
}

function createRun() {
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const runId = `${stamp}-${SCENARIO}`;
  const runDir = path.join(QA_ROOT, runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(QA_ROOT, "latest.txt"), runDir, "utf8");
  return {
    scenario: SCENARIO,
    runId,
    runDir,
    startedAt: new Date().toISOString(),
    sourceState: readQaSourceState(ROOT_DIR),
    confidenceLabel: "failed",
    evidenceTier: "static-source",
    checks: [],
    artifacts: []
  };
}

function assertNoHatchSurface(run, relativePath, checkName) {
  const source = readProjectFile(relativePath);
  const match = FORBIDDEN_HATCH_SURFACE_PATTERN.exec(source);
  if (match === null) {
    recordPass(run, checkName, { path: relativePath });
    return;
  }
  recordFail(run, checkName, {
    path: relativePath,
    matched: match[0],
    index: match.index
  });
}

function assertSnippet(run, relativePath, snippet, checkName) {
  const source = readProjectFile(relativePath);
  if (source.includes(snippet)) {
    recordPass(run, checkName, { path: relativePath });
    return;
  }
  recordFail(run, checkName, {
    path: relativePath,
    expectedSnippet: snippet
  });
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function recordPass(run, name, details = {}) {
  run.checks.push({ name, status: "pass", details });
}

function recordFail(run, name, details = {}) {
  run.checks.push({ name, status: "fail", details });
}

function finishRun(run) {
  run.finishedAt = new Date().toISOString();
  run.confidenceLabel = run.checks.some((check) => check.status === "fail")
    ? "failed"
    : "automated-pass";
  run.exactClaimAllowed =
    run.confidenceLabel === "automated-pass"
      ? "passed static V2 scope QA: Hatch/custom generation is not exposed through user-facing UI, route, preload, or IPC surfaces"
      : "No fixed claim allowed.";
  run.uncoveredConditions = [
    "archived Hatch helper internals are not production custom generation",
    "future user-facing custom generation requires a separate design and QA gate"
  ];
  const summaryPath = path.join(run.runDir, "summary.json");
  const reportPath = path.join(run.runDir, "report.md");
  run.artifacts.push("summary.json", "report.md");
  fs.writeFileSync(summaryPath, JSON.stringify(run, null, 2));
  fs.writeFileSync(reportPath, renderReport(run), "utf8");
  console.log(
    JSON.stringify(
      {
        runId: run.runId,
        checks: run.checks.length,
        report: path.relative(ROOT_DIR, reportPath),
        confidenceLabel: run.confidenceLabel
      },
      null,
      2
    )
  );
}

function renderReport(run) {
  const checks = run.checks
    .map((check) => `- ${check.status.toUpperCase()}: ${check.name}`)
    .join("\n");
  const uncovered = run.uncoveredConditions.map((condition) => `- ${condition}`).join("\n");
  return `# Deskagotchi V2 Scope QA

Scenario: ${run.scenario}

Run id: ${run.runId}

Confidence: ${run.confidenceLabel}

Evidence tier: ${run.evidenceTier}

## Checks

${checks}

## Exact Claim Allowed

${run.exactClaimAllowed}

## Uncovered Conditions

${uncovered}
`;
}

main();
