import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readQaSourceState } from "./qa-git.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = path.join(ROOT_DIR, ".qa-runs");

const STAGES = [
  {
    command: "npm.cmd",
    args: ["run", "lint"],
    checkName: "lint passed"
  },
  {
    command: "npm.cmd",
    args: ["run", "typecheck"],
    checkName: "typecheck passed"
  },
  {
    command: "npm.cmd",
    args: ["run", "test"],
    checkName: "test suite passed"
  }
];

function main() {
  const run = createRun();
  for (const stage of STAGES) {
    runCommandCheck(run, stage);
  }
  finishRun(run);

  if (run.checks.some((check) => check.status === "fail")) {
    process.exit(1);
  }
}

function createRun() {
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const runId = `${stamp}-check`;
  const runDir = path.join(QA_RUNS_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(QA_RUNS_DIR, "latest.txt"), runDir, "utf8");
  return {
    scenario: "check",
    runId,
    runDir,
    startedAt: new Date().toISOString(),
    sourceState: readQaSourceState(ROOT_DIR),
    confidenceLabel: "failed",
    evidenceTier: "static-code-quality",
    checks: [],
    artifacts: []
  };
}

function runCommandCheck(run, stage) {
  const commandParts = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", stage.command, ...stage.args]]
    : [stage.command, stage.args];
  const child = spawnSync(commandParts[0], commandParts[1], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: "pipe"
  });
  const command = `${stage.command} ${stage.args.join(" ")}`;
  const outputFileName = `${stage.checkName.replaceAll(" ", "-")}.log`;
  const outputPath = path.join(run.runDir, outputFileName);
  const output = [
    `$ ${command}`,
    "",
    "## stdout",
    child.stdout?.trim() ?? "",
    "",
    "## stderr",
    child.stderr?.trim() ?? ""
  ].join("\n");
  fs.writeFileSync(outputPath, output, "utf8");
  run.artifacts.push(outputFileName);
  recordCheck(run, stage.checkName, child.status === 0, {
    command,
    status: child.status,
    output: outputFileName
  });
}

function recordCheck(run, name, passed, details) {
  run.checks.push({
    name,
    status: passed ? "pass" : "fail",
    details
  });
}

function finishRun(run) {
  run.finishedAt = new Date().toISOString();
  run.confidenceLabel = run.checks.some((check) => check.status === "fail")
    ? "failed"
    : "automated-pass";
  run.exactClaimAllowed = run.confidenceLabel === "automated-pass"
    ? "lint, TypeScript checking, and unit tests passed for this checkout"
    : "No fixed code-quality claim allowed.";
  run.uncoveredConditions = [
    "manual desktop acceptance remains separate from static code-quality checks",
    "release packaging and installed-app behavior are covered by dedicated QA runs"
  ];
  run.artifacts.push("summary.json", "report.md");
  fs.writeFileSync(path.join(run.runDir, "summary.json"), JSON.stringify(run, null, 2));
  fs.writeFileSync(path.join(run.runDir, "report.md"), renderReport(run), "utf8");
  console.log(
    JSON.stringify(
      {
        runId: run.runId,
        checks: run.checks.length,
        confidenceLabel: run.confidenceLabel,
        report: path.relative(ROOT_DIR, path.join(run.runDir, "report.md"))
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
  const artifacts = Array.from(new Set(run.artifacts))
    .map((artifact) => `- ${artifact}`)
    .join("\n");
  return `# Deskagotchi Check QA

Scenario: ${run.scenario}

Run id: ${run.runId}

Confidence: ${run.confidenceLabel}

Evidence tier: ${run.evidenceTier}

## Checks

${checks}

## Artifacts

${artifacts}

## Exact Claim Allowed

${run.exactClaimAllowed}

## Uncovered Conditions

${run.uncoveredConditions.map((condition) => `- ${condition}`).join("\n")}
`;
}

main();
