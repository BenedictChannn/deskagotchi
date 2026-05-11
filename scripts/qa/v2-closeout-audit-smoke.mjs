import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const SMOKE_DIR = path.join(ROOT_DIR, ".qa-runs", "v2-closeout-audit-smoke");
const MANUAL_PAGE_PATH = path.join(ROOT_DIR, "docs", "qa", "v2-manual-acceptance.html");
const AUDIT_SCRIPT = path.join(ROOT_DIR, "scripts", "qa", "v2-closeout-audit.mjs");

function main() {
  fs.mkdirSync(SMOKE_DIR, { recursive: true });
  const checkKeys = readManualCheckKeys();
  const incompleteManualPath = path.join(SMOKE_DIR, "manual-incomplete.json");
  const completeManualPath = path.join(SMOKE_DIR, "manual-complete.json");
  const deferredManualPath = path.join(SMOKE_DIR, "manual-deferred.json");

  writeManualReport(incompleteManualPath, checkKeys, {
    complete: false,
    includeRequiredFields: false
  });
  writeManualReport(completeManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true
  });
  writeManualReport(deferredManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    deferredCheck: checkKeys[0]
  });

  const incompleteRun = runAudit([
    "--manual",
    incompleteManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    path.join(SMOKE_DIR, "report-incomplete.md")
  ]);
  if (incompleteRun.status !== 1) {
    throw new Error(
      `Expected incomplete manual evidence to fail strict mode, got ${incompleteRun.status}.`
    );
  }

  const completeReportPath = path.join(SMOKE_DIR, "report-complete.md");
  const completeRun = runAudit([
    "--manual",
    completeManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    completeReportPath
  ]);
  if (completeRun.status !== 0) {
    throw new Error(
      `Expected complete manual evidence to pass strict mode, got ${completeRun.status}.`
    );
  }

  const completeReport = fs.readFileSync(completeReportPath, "utf8");
  if (!completeReport.includes("Completion status: **complete**")) {
    throw new Error("Complete smoke report did not record complete status.");
  }

  const deferredRun = runAudit([
    "--manual",
    deferredManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    path.join(SMOKE_DIR, "report-deferred.md")
  ]);
  if (deferredRun.status !== 0) {
    throw new Error(
      `Expected explicitly deferred manual evidence to pass strict mode, got ${deferredRun.status}.`
    );
  }

  console.log(
    JSON.stringify(
      {
        checkCount: checkKeys.length,
        incompleteStrictExit: incompleteRun.status,
        completeStrictExit: completeRun.status,
        deferredStrictExit: deferredRun.status,
        report: path.relative(ROOT_DIR, completeReportPath)
      },
      null,
      2
    )
  );
}

function readManualCheckKeys() {
  const manualPage = fs.readFileSync(MANUAL_PAGE_PATH, "utf8");
  const checkKeys = new Set();
  const dataCheckPattern = /data-check="([^"]+)"/g;
  let match = dataCheckPattern.exec(manualPage);

  while (match !== null) {
    checkKeys.add(match[1]);
    match = dataCheckPattern.exec(manualPage);
  }

  return Array.from(checkKeys).sort();
}

function writeManualReport(filePath, checkKeys, options) {
  const checks = Object.fromEntries(
    checkKeys.map((checkKey) => [
      checkKey,
      options.deferredCheck === checkKey ? false : options.complete
    ])
  );
  const deferrals = Object.fromEntries(
    checkKeys.map((checkKey) => [
      checkKey,
      {
        accepted: options.deferredCheck === checkKey,
        rationale: options.deferredCheck === checkKey
          ? "Accepted as out of scope for this smoke fixture."
          : ""
      }
    ])
  );
  const fields = options.includeRequiredFields
    ? {
        tester: "V2 closeout audit smoke",
        date: "2026-05-11",
        windowsVersion: "Windows smoke fixture",
        build: "smoke-fixture",
        monitorSetup: "smoke fixture",
        acceptedOutOfScopeBy: options.deferredCheck === undefined
          ? ""
          : "V2 smoke approver"
      }
    : {
        tester: "V2 closeout audit smoke"
      };
  const acceptedOutOfScopeBy = fields.acceptedOutOfScopeBy ?? "";
  const blockingChecks = checkKeys.filter((checkKey) => {
    if (checks[checkKey]) {
      return false;
    }
    const deferral = deferrals[checkKey];
    return !(
      deferral.accepted &&
      deferral.rationale.trim().length > 0 &&
      acceptedOutOfScopeBy.trim().length > 0
    );
  });

  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        fields,
        checks,
        deferrals,
        expectedChecks: checkKeys,
        blockingChecks,
        manualPass: blockingChecks.length === 0,
        exportedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
}

function runAudit(args) {
  return spawnSync("node", [AUDIT_SCRIPT, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: "pipe"
  });
}

main();
