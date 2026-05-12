import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

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
