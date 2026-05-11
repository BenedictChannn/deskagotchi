import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = resolveQaRunsDir();
const RUN_ID = `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}-manual-preflight`;
const RUN_DIR = path.join(QA_RUNS_DIR, RUN_ID);
const CLOSEOUT_AUDIT_SCRIPT = path.join(ROOT_DIR, "scripts", "qa", "v2-closeout-audit.mjs");
const DEFAULT_MANUAL_PATHS = [
  "docs/qa/v2-manual-acceptance-export.json",
  "docs/qa/v2-manual-acceptance.json"
];

function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(path.join(QA_RUNS_DIR, "latest.txt"), RUN_DIR, "utf8");
  const startedAt = new Date().toISOString();
  const manualPath = resolveManualPath(process.argv.slice(2));
  const reportPath = path.join(RUN_DIR, "closeout-report.md");
  const audit = runCloseoutAudit(manualPath, reportPath);
  const report = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf8") : "";
  const manualSection = extractManualSection(report);
  const blockers = extractManualBlockers(manualSection);
  const closeoutComplete = report.includes("Completion status: **complete**");
  const status = manualPath !== null &&
    fs.existsSync(reportPath) &&
    blockers.length === 0 &&
    closeoutComplete
    ? "pass"
    : "manual-open";
  const checks = [
    {
      name: "manual evidence path resolved",
      status: manualPath === null ? "fail" : "pass",
      details: {
        manualPath: manualPath ?? "not found"
      }
    },
    {
      name: "closeout audit report generated",
      status: fs.existsSync(reportPath) ? "pass" : "fail",
      details: {
        report: path.relative(ROOT_DIR, reportPath),
        auditExitCode: audit.status,
        stderr: audit.stderr
      }
    },
    {
      name: "manual blockers summarized",
      status: blockers.length === 0 ? "pass" : "manual-open",
      details: {
        blockerCount: blockers.length,
        blockers
      }
    }
  ];
  const summary = {
    scenario: "manual-preflight",
    runId: RUN_ID,
    startedAt,
    finishedAt: new Date().toISOString(),
    confidenceLabel: status === "pass" ? "automated-pass" : "manual-open",
    evidenceTier: "audit-wrapper",
    checks,
    artifacts: ["summary.json", "report.md", "closeout-report.md"],
    exactClaimAllowed: status === "pass"
      ? "manual evidence passed V2 closeout audit preflight"
      : "manual evidence is still incomplete; see summarized blockers",
    uncoveredConditions: [
      "this preflight does not execute physical manual gates",
      "final release closeout still requires a clean worktree and npm.cmd run qa:v2:closeout"
    ],
    manualPath,
    closeoutAuditExitCode: audit.status,
    closeoutComplete,
    blockers
  };

  fs.writeFileSync(path.join(RUN_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(RUN_DIR, "report.md"), renderReport(summary), "utf8");
  console.log(
    JSON.stringify(
      {
        runId: RUN_ID,
        confidenceLabel: summary.confidenceLabel,
        blockerCount: blockers.length,
        manualPath,
        report: path.relative(ROOT_DIR, path.join(RUN_DIR, "report.md")),
        closeoutReport: path.relative(ROOT_DIR, reportPath)
      },
      null,
      2
    )
  );

  if (status !== "pass") {
    process.exit(1);
  }
}

function resolveQaRunsDir() {
  const configuredPath = process.env.DESKAGOTCHI_QA_RUNS_DIR;
  if (configuredPath === undefined || configuredPath.trim().length === 0) {
    return path.join(ROOT_DIR, ".qa-runs");
  }
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(ROOT_DIR, configuredPath);
}

function resolveManualPath(args) {
  const manualFlagIndex = args.indexOf("--manual");
  if (manualFlagIndex !== -1) {
    const manualPath = args[manualFlagIndex + 1];
    if (manualPath === undefined || manualPath.startsWith("--")) {
      throw new Error("--manual requires a JSON path.");
    }
    return path.isAbsolute(manualPath)
      ? manualPath
      : path.join(ROOT_DIR, manualPath);
  }

  const existingPath = DEFAULT_MANUAL_PATHS
    .map((manualPath) => path.join(ROOT_DIR, manualPath))
    .find((manualPath) => fs.existsSync(manualPath));
  return existingPath ?? null;
}

function runCloseoutAudit(manualPath, reportPath) {
  const args = [
    CLOSEOUT_AUDIT_SCRIPT,
    "--allow-dirty",
    "--report",
    reportPath
  ];
  if (manualPath !== null) {
    args.push("--manual", manualPath);
  }
  const result = spawnSync("node", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: "pipe"
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

function extractManualSection(report) {
  const startMarker = "## Manual Acceptance";
  const endMarker = "## Strict Mode";
  const startIndex = report.indexOf(startMarker);
  const endIndex = report.indexOf(endMarker);
  if (startIndex === -1) {
    return "";
  }
  return report.slice(startIndex, endIndex === -1 ? report.length : endIndex).trim();
}

function extractManualBlockers(manualSection) {
  return manualSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

function renderReport(summary) {
  const checks = summary.checks
    .map((check) => `- ${check.status.toUpperCase()}: ${check.name}`)
    .join("\n");
  const blockers = summary.blockers.length === 0
    ? "- None"
    : summary.blockers.map((blocker) => `- ${blocker}`).join("\n");
  return `# Deskagotchi V2 Manual Preflight

Run ID: ${summary.runId}

Confidence: ${summary.confidenceLabel}

Evidence tier: ${summary.evidenceTier}

Manual path: ${summary.manualPath ?? "not found"}

Closeout audit exit code: ${summary.closeoutAuditExitCode}

Closeout complete: ${summary.closeoutComplete ? "yes" : "no"}

## Checks

${checks}

## Manual Blockers

${blockers}

## Artifacts

${summary.artifacts.map((artifact) => `- ${artifact}`).join("\n")}

## Exact Claim Allowed

${summary.exactClaimAllowed}

## Uncovered Conditions

${summary.uncoveredConditions.map((condition) => `- ${condition}`).join("\n")}
`;
}

main();
