import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = resolveQaRunsDir();
const LATEST_CONTEXT_PATH = path.join(QA_RUNS_DIR, "latest-v2-manual-context.json");
const LATEST_SESSION_PATH = path.join(QA_RUNS_DIR, "latest-v2-manual-acceptance.html");
const PREFLIGHT_SCRIPT = path.join(ROOT_DIR, "scripts", "qa", "v2-manual-preflight.mjs");
const DEFAULT_EXPORT_PATH = path.join(ROOT_DIR, "docs", "qa", "v2-manual-acceptance-export.json");

function main() {
  const context = readJsonIfExists(LATEST_CONTEXT_PATH);
  const preflight = runManualPreflight();
  const preflightSummary = parseJsonObject(preflight.stdout);
  const manualPath = normalizeManualPath(preflightSummary?.manualPath ?? null);
  const blockerCount = parseNumericField(preflightSummary?.blockerCount);
  const blockerBatchCount = parseNumericField(preflightSummary?.blockerBatchCount);
  const readyForCloseout = preflight.status === 0 && manualPath !== null && blockerCount === 0;
  const acceptancePageUrl = resolveAcceptancePageUrl(context);
  const summary = {
    status: readyForCloseout ? "manual-evidence-ready" : "manual-open",
    build: readContextBuild(context),
    gateCount: readContextGateCount(context),
    blockerCount,
    blockerBatchCount,
    manualExportPath: path.relative(ROOT_DIR, DEFAULT_EXPORT_PATH),
    manualExportExists: fs.existsSync(DEFAULT_EXPORT_PATH),
    detectedManualPath: manualPath,
    acceptancePage: path.relative(ROOT_DIR, LATEST_SESSION_PATH),
    acceptancePageUrl,
    latestContext: path.relative(ROOT_DIR, LATEST_CONTEXT_PATH),
    latestContextExists: context !== null,
    preflightExitCode: preflight.status,
    preflightReport: preflightSummary?.report ?? null,
    closeoutReport: preflightSummary?.closeoutReport ?? null,
    nextCommands: buildNextCommands(readyForCloseout, context !== null)
  };

  console.log(JSON.stringify(summary, null, 2));
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

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runManualPreflight() {
  const result = spawnSync("node", [PREFLIGHT_SCRIPT], {
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

function parseJsonObject(value) {
  if (value.length === 0) {
    return null;
  }
  return JSON.parse(value);
}

function normalizeManualPath(manualPath) {
  if (manualPath === null || manualPath === undefined) {
    return null;
  }
  if (typeof manualPath !== "string" || manualPath.trim().length === 0) {
    return null;
  }
  return path.isAbsolute(manualPath)
    ? path.relative(ROOT_DIR, manualPath)
    : manualPath;
}

function parseNumericField(value) {
  return Number.isInteger(value) ? value : null;
}

function resolveAcceptancePageUrl(context) {
  const contextUrl = context?.manualAcceptance?.latestSessionUrl;
  if (typeof contextUrl === "string" && contextUrl.trim().length > 0) {
    return contextUrl;
  }
  return pathToFileURL(LATEST_SESSION_PATH).href;
}

function readContextBuild(context) {
  const build = context?.fields?.build;
  return typeof build === "string" && build.trim().length > 0 ? build : null;
}

function readContextGateCount(context) {
  const gateCount = context?.manualAcceptance?.gateCount;
  return Number.isInteger(gateCount) ? gateCount : null;
}

function buildNextCommands(readyForCloseout, contextExists) {
  if (!contextExists) {
    return [
      "npm.cmd run qa:v2:manual-open",
      "npm.cmd run qa:v2:manual-status"
    ];
  }

  if (!readyForCloseout) {
    return [
      "Open .qa-runs/latest-v2-manual-acceptance.html",
      "Complete or defer every manual gate with evidence notes",
      "Save the exported JSON as docs\\qa\\v2-manual-acceptance-export.json",
      "npm.cmd run qa:v2:manual-status"
    ];
  }

  return [
    "npm.cmd run qa:v2:audit -- --manual docs\\qa\\v2-manual-acceptance-export.json",
    "git add docs\\qa\\v2-manual-acceptance-export.json docs\\qa\\v2-closeout-report.md",
    "git commit -m \"docs(qa): add v2 manual acceptance evidence\"",
    "npm.cmd run qa:v2:closeout"
  ];
}

main();
