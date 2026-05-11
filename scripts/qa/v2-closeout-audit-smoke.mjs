import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const SMOKE_DIR = path.join(ROOT_DIR, ".qa-runs", "v2-closeout-audit-smoke");
const IN_PROGRESS_MANUAL_PAGE_RUN_ID = "9999-12-31T23-59-59Z-manual-page";
const IN_PROGRESS_MANUAL_PAGE_RUN_DIR = path.join(
  ROOT_DIR,
  ".qa-runs",
  IN_PROGRESS_MANUAL_PAGE_RUN_ID
);
const MANUAL_PAGE_PATH = path.join(ROOT_DIR, "docs", "qa", "v2-manual-acceptance.html");
const AUDIT_SCRIPT = path.join(ROOT_DIR, "scripts", "qa", "v2-closeout-audit.mjs");

function main() {
  fs.mkdirSync(SMOKE_DIR, { recursive: true });
  assertManualPageGuardsRunContext();
  const checkKeys = readManualCheckKeys();
  const incompleteManualPath = path.join(SMOKE_DIR, "manual-incomplete.json");
  const missingFieldsManualPath = path.join(SMOKE_DIR, "manual-missing-fields.json");
  const completeManualPath = path.join(SMOKE_DIR, "manual-complete.json");
  const deferredManualPath = path.join(SMOKE_DIR, "manual-deferred.json");

  writeManualReport(incompleteManualPath, checkKeys, {
    complete: false,
    includeRequiredFields: false
  });
  writeManualReport(missingFieldsManualPath, checkKeys, {
    complete: true,
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
  writeInProgressManualPageRun();

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

  const missingManualReportPath = path.join(SMOKE_DIR, "report-missing-manual.md");
  const missingManualRun = runAudit([
    "--manual",
    path.join(SMOKE_DIR, "does-not-exist.json"),
    "--strict",
    "--allow-dirty",
    "--report",
    missingManualReportPath
  ]);
  if (missingManualRun.status !== 1) {
    throw new Error(
      `Expected missing manual evidence to fail strict mode, got ${missingManualRun.status}.`
    );
  }
  const missingManualReport = fs.readFileSync(missingManualReportPath, "utf8");
  if (!missingManualReport.includes(
    "Manual gate not exported: visual.pets: All five pets read as intended animals at desktop size."
  )) {
    throw new Error("Missing manual evidence report did not include labeled gate blockers.");
  }

  const missingFieldsReportPath = path.join(SMOKE_DIR, "report-missing-fields.md");
  const missingFieldsRun = runAudit([
    "--manual",
    missingFieldsManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    missingFieldsReportPath
  ]);
  if (missingFieldsRun.status !== 1) {
    throw new Error(
      `Expected missing required run context fields to fail strict mode, got ${missingFieldsRun.status}.`
    );
  }
  const missingFieldsReport = fs.readFileSync(missingFieldsReportPath, "utf8");
  if (!missingFieldsReport.includes("Missing manual context field: date")) {
    throw new Error("Missing-fields report did not include required context blockers.");
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
  if (completeReport.includes(IN_PROGRESS_MANUAL_PAGE_RUN_ID)) {
    throw new Error("Complete smoke report used an in-progress manual-page QA run.");
  }

  const checkOnlyReportPath = path.join(SMOKE_DIR, "report-check-only.md");
  fs.rmSync(checkOnlyReportPath, { force: true });
  const checkOnlyRun = runAudit([
    "--manual",
    completeManualPath,
    "--strict",
    "--allow-dirty",
    "--check-only",
    "--report",
    checkOnlyReportPath
  ]);
  if (checkOnlyRun.status !== 0) {
    throw new Error(
      `Expected check-only complete manual evidence to pass strict mode, got ${checkOnlyRun.status}.`
    );
  }
  if (fs.existsSync(checkOnlyReportPath)) {
    throw new Error("Check-only audit wrote a report file.");
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
        missingManualStrictExit: missingManualRun.status,
        missingFieldsStrictExit: missingFieldsRun.status,
        completeStrictExit: completeRun.status,
        inProgressManualPageRunSkipped: true,
        checkOnlyStrictExit: checkOnlyRun.status,
        deferredStrictExit: deferredRun.status,
        report: path.relative(ROOT_DIR, completeReportPath)
      },
      null,
      2
    )
  );
}

function writeInProgressManualPageRun() {
  fs.rmSync(IN_PROGRESS_MANUAL_PAGE_RUN_DIR, { recursive: true, force: true });
  fs.mkdirSync(IN_PROGRESS_MANUAL_PAGE_RUN_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(IN_PROGRESS_MANUAL_PAGE_RUN_DIR, "report.md"),
    "# In-progress manual-page QA run\n\nNo summary.json has been written yet.\n"
  );
}

function assertManualPageGuardsRunContext() {
  const manualPage = fs.readFileSync(MANUAL_PAGE_PATH, "utf8");
  const requiredSnippets = [
    "const requiredManualFields =",
    "fieldFailures",
    "manualPass: blockingChecks.length === 0 && fieldFailures.length === 0",
    "Manual pass is still blocked."
  ];
  for (const snippet of requiredSnippets) {
    if (!manualPage.includes(snippet)) {
      throw new Error(`Manual acceptance page is missing run-context guard: ${snippet}`);
    }
  }
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
