import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const SMOKE_DIR = path.join(ROOT_DIR, ".qa-runs", "v2-closeout-audit-smoke");
const SMOKE_QA_RUNS_DIR = path.join(SMOKE_DIR, "qa-runs");
const IN_PROGRESS_MANUAL_PAGE_RUN_ID = "9999-12-31T23-59-59Z-manual-page";
const IN_PROGRESS_MANUAL_PAGE_RUN_DIR = path.join(
  SMOKE_QA_RUNS_DIR,
  IN_PROGRESS_MANUAL_PAGE_RUN_ID
);
const MANUAL_PAGE_PATH = path.join(ROOT_DIR, "docs", "qa", "v2-manual-acceptance.html");
const AUDIT_SCRIPT = path.join(ROOT_DIR, "scripts", "qa", "v2-closeout-audit.mjs");
const AUTOMATED_FIXTURES = [
  {
    suffix: "launch",
    checks: [
      "no existing non-QA Deskagotchi process detected",
      "electron launched",
      "overlay rendered pet sprite",
      "userData path is isolated",
      "overlay window role detected"
    ]
  },
  {
    suffix: "drag",
    checks: [
      "OS drag moved native overlay bounds",
      "drag did not leave care menu closed",
      "drag bounds persisted to QA save",
      "relaunch restored persisted pet position",
      "OS drag crossed onto negative-coordinate monitor"
    ]
  },
  {
    suffix: "overlay",
    checks: [
      "overlay menu opened",
      "feed picker shows scoped food choices",
      "meal eating feedback uses selected food cue",
      "snack eating feedback uses selected food cue",
      "health opens compact overlay card",
      "overlay health did not open a panel window"
    ]
  },
  {
    suffix: "play",
    checks: [
      "play mode expanded overlay bounds",
      "play stage has no visible boundary",
      "play controls and sprites are desktop-readable",
      "play exit restored compact overlay size"
    ]
  },
  {
    suffix: "lifecycle",
    checks: [
      "no existing non-QA Deskagotchi process detected",
      "overlay starts with always-on-top enabled",
      "second launch reset and showed pet window",
      "powerMonitor resume progressed simulation and refreshed renderer",
      "powerMonitor unlock-screen progressed simulation and refreshed renderer",
      "always-on-top setting disabled native overlay flag",
      "relaunch preserved disabled always-on-top setting",
      "always-on-top setting re-enabled native overlay flag",
      "QA process tree cleaned up"
    ]
  },
  {
    suffix: "renderer",
    checks: [
      "panel route status rendered",
      "panel route pet-selector rendered",
      "panel route settings rendered"
    ]
  },
  {
    suffix: "idle",
    checks: ["idle CPU stayed below threshold"],
    checkDetails: {
      "idle CPU stayed below threshold": {
        durationSeconds: 300,
        cpuPercentOfOneCore: 1.2,
        limitPercentOfOneCore: 10
      }
    },
    artifacts: ["idle-cpu.json"]
  },
  {
    suffix: "release",
    checks: [
      "Windows installer exists",
      "packaged executable exists",
      "packaged item manifest matches source asset version",
      "packaged item atlas matches source bytes",
      "packaged executable launches with isolated QA profile",
      "packaged executable passes lifecycle recovery smoke",
      "silent installer completed",
      "installed executable launches with isolated QA profile",
      "silent uninstaller completed",
      "silent uninstaller removed installed executable"
    ]
  },
  {
    suffix: "check",
    checks: [
      "lint passed",
      "typecheck passed",
      "test suite passed"
    ]
  },
  {
    suffix: "assets-pets",
    checks: [
      "built-in pet package registry validation passed",
      "bao manifest exists",
      "bao spritesheet exists",
      "bao preview exists",
      "bao icon exists",
      "bao contact sheet exists",
      "miso manifest exists",
      "miso spritesheet exists",
      "miso preview exists",
      "miso icon exists",
      "miso contact sheet exists",
      "mochi manifest exists",
      "mochi spritesheet exists",
      "mochi preview exists",
      "mochi icon exists",
      "mochi contact sheet exists",
      "peanut manifest exists",
      "peanut spritesheet exists",
      "peanut preview exists",
      "peanut icon exists",
      "peanut contact sheet exists",
      "puddles manifest exists",
      "puddles spritesheet exists",
      "puddles preview exists",
      "puddles icon exists",
      "puddles contact sheet exists",
      "V2 visual acceptance page exists",
      "built-in pet manifests use retro-LCD capability",
      "built-in pet palettes use at most four colors"
    ]
  },
  {
    suffix: "assets-items",
    checks: [
      "item manifest exists and parses",
      "full item icon contact sheet exists",
      "food icon contact sheet exists",
      "item manifest includes food items",
      "item atlas referenced by manifest exists"
    ]
  },
  {
    suffix: "manual-page",
    checks: [
      "manual acceptance page loaded",
      "manual acceptance page shows closeout target path",
      "manual gate count matched",
      "blank run context blocks manual pass",
      "embedded manual context prefills without resolving gates",
      "manual context import prefills without resolving gates",
      "same manual context import preserves current gate decisions",
      "new manual context import resets stale gate decisions",
      "manual gate pass and deferral remain mutually exclusive",
      "all gates without run context blocks manual pass",
      "manual context import is required for pass",
      "all gates with imported context exports manual pass",
      "deferral without approver blocks manual pass",
      "deferral with approver exports manual pass",
      "manual acceptance screenshot captured"
    ]
  },
  {
    suffix: "manual-context-smoke",
    checks: [
      "manual context fails without complete automated evidence",
      "manual context passes with complete automated evidence",
      "manual context report includes code and asset evidence"
    ]
  },
  {
    suffix: "manual-preflight-smoke",
    checks: [
      "closeout smoke fixture setup passed",
      "manual preflight fails without manual evidence",
      "manual preflight passes with complete manual evidence"
    ]
  },
  {
    suffix: "visual-page",
    checks: [
      "visual acceptance page loaded",
      "visual acceptance page has every built-in pet card",
      "visual acceptance page has food and item review sheets",
      "visual acceptance page has six review criteria",
      "visual acceptance page pet names match built-in roster",
      "visual acceptance page images load",
      "visual acceptance screenshot captured",
      "pet animation gallery loaded",
      "pet animation gallery has every built-in pet card",
      "pet animation gallery has every core animation row",
      "pet animation gallery pet names match built-in roster",
      "pet animation gallery sprites reference committed spritesheets",
      "pet animation gallery pause control works",
      "pet animation gallery play control works",
      "pet animation gallery preview images load",
      "pet animation gallery screenshot captured"
    ]
  },
  {
    suffix: "v2-scope",
    checks: [
      "IPC contract has no Hatch generation channel",
      "preload bridge exposes no Hatch generation method",
      "main process registers no Hatch IPC handler",
      "renderer router has no Hatch panel route",
      "management panel has no Hatch tab",
      "overlay has no Hatch action",
      "README marks Hatch/custom generation deferred for V2",
      "README archives user-facing Hatch for the V2 release path",
      "V2 roadmap archives custom pet generation",
      "V2 success criteria exclude user-facing custom generation"
    ]
  }
];

function main() {
  fs.mkdirSync(SMOKE_DIR, { recursive: true });
  writeCompleteAutomatedEvidence();
  assertManualPageGuardsRunContext();
  const checkKeys = readManualCheckKeys();
  const incompleteManualPath = path.join(SMOKE_DIR, "manual-incomplete.json");
  const missingFieldsManualPath = path.join(SMOKE_DIR, "manual-missing-fields.json");
  const conflictedManualPath = path.join(SMOKE_DIR, "manual-conflicted.json");
  const staleGateManualPath = path.join(SMOKE_DIR, "manual-stale-gate.json");
  const missingMetadataManualPath = path.join(SMOKE_DIR, "manual-missing-metadata.json");
  const staleExportTimeManualPath = path.join(SMOKE_DIR, "manual-stale-export-time.json");
  const invalidBuildManualPath = path.join(SMOKE_DIR, "manual-invalid-build.json");
  const invalidVersionManualPath = path.join(SMOKE_DIR, "manual-invalid-version.json");
  const staleCodeManualPath = path.join(SMOKE_DIR, "manual-stale-code.json");
  const mismatchedBuildManualPath = path.join(SMOKE_DIR, "manual-mismatched-build.json");
  const mismatchedInstallerManualPath = path.join(SMOKE_DIR, "manual-mismatched-installer.json");
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
  writeManualReport(conflictedManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    conflictedCheck: checkKeys[0]
  });
  writeManualReport(staleGateManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    unknownCheck: "stale.manual.gate"
  });
  writeManualReport(missingMetadataManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    omitReportMetadata: true
  });
  writeManualReport(staleExportTimeManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    exportedAtOverride: "2026-05-10T23:59:59.000Z"
  });
  writeManualReport(invalidBuildManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    invalidBuildCommit: true
  });
  writeManualReport(invalidVersionManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    invalidBuildVersion: true
  });
  writeManualReport(staleCodeManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    buildCommitOverride: readPostBuildCodeChangeCommit()
  });
  writeManualReport(mismatchedBuildManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    mismatchedBuildSignature: true
  });
  writeManualReport(mismatchedInstallerManualPath, checkKeys, {
    complete: true,
    includeRequiredFields: true,
    mismatchedInstallerPathSignature: true
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
  if (!missingFieldsReport.includes("Missing manual evidence note: visualNotes")) {
    throw new Error("Missing-fields report did not include required evidence-note blockers.");
  }

  const conflictedReportPath = path.join(SMOKE_DIR, "report-conflicted.md");
  const conflictedRun = runAudit([
    "--manual",
    conflictedManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    conflictedReportPath
  ]);
  if (conflictedRun.status !== 1) {
    throw new Error(
      `Expected conflicted manual evidence to fail strict mode, got ${conflictedRun.status}.`
    );
  }
  const conflictedReport = fs.readFileSync(conflictedReportPath, "utf8");
  if (!conflictedReport.includes("Manual gate cannot be both checked and deferred")) {
    throw new Error("Conflicted manual report did not include gate conflict blockers.");
  }

  const staleGateReportPath = path.join(SMOKE_DIR, "report-stale-gate.md");
  const staleGateRun = runAudit([
    "--manual",
    staleGateManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    staleGateReportPath
  ]);
  if (staleGateRun.status !== 1) {
    throw new Error(
      `Expected stale-gate manual evidence to fail strict mode, got ${staleGateRun.status}.`
    );
  }
  const staleGateReport = fs.readFileSync(staleGateReportPath, "utf8");
  if (!staleGateReport.includes("Manual acceptance JSON expectedChecks has unknown gate")) {
    throw new Error("Stale-gate manual report did not include expectedChecks blocker.");
  }
  if (!staleGateReport.includes("Manual acceptance JSON checks has unknown gate")) {
    throw new Error("Stale-gate manual report did not include checks blocker.");
  }
  if (!staleGateReport.includes("Manual acceptance JSON deferrals has unknown gate")) {
    throw new Error("Stale-gate manual report did not include deferrals blocker.");
  }

  const missingMetadataReportPath = path.join(SMOKE_DIR, "report-missing-metadata.md");
  const missingMetadataRun = runAudit([
    "--manual",
    missingMetadataManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    missingMetadataReportPath
  ]);
  if (missingMetadataRun.status !== 1) {
    throw new Error(
      `Expected missing-metadata manual evidence to fail strict mode, got ${missingMetadataRun.status}.`
    );
  }
  const missingMetadataReport = fs.readFileSync(missingMetadataReportPath, "utf8");
  if (!missingMetadataReport.includes("Manual acceptance JSON is missing manualContextSignature")) {
    throw new Error("Missing-metadata manual report did not include context signature blocker.");
  }
  if (!missingMetadataReport.includes("Manual acceptance JSON is missing requiredFields")) {
    throw new Error("Missing-metadata manual report did not include requiredFields blocker.");
  }
  if (!missingMetadataReport.includes("Manual acceptance JSON is missing requiredEvidenceFields")) {
    throw new Error("Missing-metadata manual report did not include requiredEvidenceFields blocker.");
  }
  if (!missingMetadataReport.includes("Manual acceptance JSON has missing or invalid exportedAt")) {
    throw new Error("Missing-metadata manual report did not include exportedAt blocker.");
  }

  const staleExportTimeReportPath = path.join(SMOKE_DIR, "report-stale-export-time.md");
  const staleExportTimeRun = runAudit([
    "--manual",
    staleExportTimeManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    staleExportTimeReportPath
  ]);
  if (staleExportTimeRun.status !== 1) {
    throw new Error(
      `Expected stale-export-time manual evidence to fail strict mode, got ${staleExportTimeRun.status}.`
    );
  }
  const staleExportTimeReport = fs.readFileSync(staleExportTimeReportPath, "utf8");
  if (!staleExportTimeReport.includes("Manual acceptance JSON exportedAt is earlier than manual context generation time")) {
    throw new Error("Stale-export-time report did not include context timestamp blocker.");
  }

  const invalidBuildReportPath = path.join(SMOKE_DIR, "report-invalid-build.md");
  const invalidBuildRun = runAudit([
    "--manual",
    invalidBuildManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    invalidBuildReportPath
  ]);
  if (invalidBuildRun.status !== 1) {
    throw new Error(
      `Expected invalid-build manual evidence to fail strict mode, got ${invalidBuildRun.status}.`
    );
  }
  const invalidBuildReport = fs.readFileSync(invalidBuildReportPath, "utf8");
  if (!invalidBuildReport.includes("Manual acceptance JSON build commit does not exist")) {
    throw new Error("Invalid-build manual report did not include missing commit blocker.");
  }

  const invalidVersionReportPath = path.join(SMOKE_DIR, "report-invalid-version.md");
  const invalidVersionRun = runAudit([
    "--manual",
    invalidVersionManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    invalidVersionReportPath
  ]);
  if (invalidVersionRun.status !== 1) {
    throw new Error(
      `Expected invalid-version manual evidence to fail strict mode, got ${invalidVersionRun.status}.`
    );
  }
  const invalidVersionReport = fs.readFileSync(invalidVersionReportPath, "utf8");
  if (!invalidVersionReport.includes("Manual acceptance JSON build version does not match")) {
    throw new Error("Invalid-version manual report did not include package version blocker.");
  }

  const staleCodeReportPath = path.join(SMOKE_DIR, "report-stale-code.md");
  const staleCodeRun = runAudit([
    "--manual",
    staleCodeManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    staleCodeReportPath
  ]);
  if (staleCodeRun.status !== 1) {
    throw new Error(
      `Expected stale-code manual evidence to fail strict mode, got ${staleCodeRun.status}.`
    );
  }
  const staleCodeReport = fs.readFileSync(staleCodeReportPath, "utf8");
  if (!staleCodeReport.includes("Manual acceptance JSON build has app/code changes after manual evidence")) {
    throw new Error("Stale-code manual report did not include post-build code blocker.");
  }

  const mismatchedBuildReportPath = path.join(SMOKE_DIR, "report-mismatched-build.md");
  const mismatchedBuildRun = runAudit([
    "--manual",
    mismatchedBuildManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    mismatchedBuildReportPath
  ]);
  if (mismatchedBuildRun.status !== 1) {
    throw new Error(
      `Expected mismatched-build manual evidence to fail strict mode, got ${mismatchedBuildRun.status}.`
    );
  }
  const mismatchedBuildReport = fs.readFileSync(mismatchedBuildReportPath, "utf8");
  if (!mismatchedBuildReport.includes("Manual acceptance JSON build does not match manualContextSignature")) {
    throw new Error("Mismatched-build manual report did not include context-signature blocker.");
  }

  const mismatchedInstallerReportPath = path.join(SMOKE_DIR, "report-mismatched-installer.md");
  const mismatchedInstallerRun = runAudit([
    "--manual",
    mismatchedInstallerManualPath,
    "--strict",
    "--allow-dirty",
    "--report",
    mismatchedInstallerReportPath
  ]);
  if (mismatchedInstallerRun.status !== 1) {
    throw new Error(
      `Expected mismatched-installer manual evidence to fail strict mode, got ${mismatchedInstallerRun.status}.`
    );
  }
  const mismatchedInstallerReport = fs.readFileSync(mismatchedInstallerReportPath, "utf8");
  if (!mismatchedInstallerReport.includes("Manual acceptance JSON installerPath does not match manualContextSignature")) {
    throw new Error("Mismatched-installer manual report did not include context-signature blocker.");
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
  if (!completeReport.includes("V2 visual acceptance pages")) {
    throw new Error("Complete smoke report did not include visual-page evidence.");
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
        conflictedStrictExit: conflictedRun.status,
        staleGateStrictExit: staleGateRun.status,
        missingMetadataStrictExit: missingMetadataRun.status,
        staleExportTimeStrictExit: staleExportTimeRun.status,
        invalidBuildStrictExit: invalidBuildRun.status,
        invalidVersionStrictExit: invalidVersionRun.status,
        staleCodeStrictExit: staleCodeRun.status,
        mismatchedBuildStrictExit: mismatchedBuildRun.status,
        mismatchedInstallerStrictExit: mismatchedInstallerRun.status,
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

function writeCompleteAutomatedEvidence() {
  fs.rmSync(SMOKE_QA_RUNS_DIR, { recursive: true, force: true });
  fs.mkdirSync(SMOKE_QA_RUNS_DIR, { recursive: true });
  for (const fixture of AUTOMATED_FIXTURES) {
    writeAutomatedRun(fixture);
  }
}

function writeAutomatedRun(fixture) {
  const runId = `9999-12-31T23-58-59Z-${fixture.suffix}`;
  const runDir = path.join(SMOKE_QA_RUNS_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });
  const artifacts = fixture.artifacts ?? [];
  const summary = {
    scenario: fixture.suffix,
    runId,
    startedAt: "9999-12-31T23:58:00.000Z",
    confidenceLabel: "automated-pass",
    evidenceTier: "smoke-fixture",
    checks: fixture.checks.map((name) => ({
      name,
      status: "pass",
      details: fixture.checkDetails?.[name] ?? {}
    })),
    artifacts,
    finishedAt: "9999-12-31T23:58:30.000Z",
    exactClaimAllowed: `smoke fixture for ${fixture.suffix}`,
    uncoveredConditions: []
  };
  fs.writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(runDir, "report.md"), `# ${fixture.suffix} smoke fixture\n`);
  if (fixture.suffix === "idle") {
    fs.writeFileSync(
      path.join(runDir, "idle-cpu.json"),
      JSON.stringify({ durationSeconds: 300, cpuPercentOfOneCore: 1.2 }, null, 2)
    );
  }
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
    "evidenceFailures",
    "conflictFailures",
    "expectedChecks",
    "requiredFields",
    "requiredEvidenceFields",
    "manualPass: blockingChecks.length === 0 && fieldFailures.length === 0 && evidenceFailures.length === 0 && conflictFailures.length === 0",
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
  const dataCheckPattern = /<label class="check">\s*<input data-check="([^"]+)"[^>]*\/>\s*<span>.*?<\/span>\s*<\/label>/gs;
  let match = dataCheckPattern.exec(manualPage);

  while (match !== null) {
    checkKeys.add(match[1]);
    match = dataCheckPattern.exec(manualPage);
  }

  return Array.from(checkKeys).sort();
}

function writeManualReport(filePath, checkKeys, options) {
  const buildVersion = options.invalidBuildVersion === true
    ? "99.99.99-smoke"
    : readPackageVersion();
  const buildCommit = options.invalidBuildCommit === true
    ? "0000000000000000000000000000000000000000"
    : options.buildCommitOverride ?? readCurrentCommit();
  const build = `${buildVersion} / ${buildCommit}`;
  const signatureBuild = options.mismatchedBuildSignature === true
    ? "0.1.0 / 1111111111111111111111111111111111111111"
    : build;
  const installerPath = "release/Deskagotchi Setup 0.1.0.exe";
  const signatureInstallerPath = options.mismatchedInstallerPathSignature === true
    ? "release/Deskagotchi Setup stale-smoke.exe"
    : installerPath;
  const reportCheckKeys = options.unknownCheck === undefined
    ? checkKeys
    : [...checkKeys, options.unknownCheck];
  const checks = Object.fromEntries(
    reportCheckKeys.map((checkKey) => [
      checkKey,
      options.deferredCheck === checkKey ? false : options.complete
    ])
  );
  const deferrals = Object.fromEntries(
    reportCheckKeys.map((checkKey) => [
      checkKey,
      {
        accepted: options.deferredCheck === checkKey ||
          options.conflictedCheck === checkKey,
        rationale: options.deferredCheck === checkKey ||
          options.conflictedCheck === checkKey
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
        build,
        monitorSetup: "smoke fixture",
        installerPath,
        visualNotes: "Visual fixture notes.",
        installerNotes: "Installer fixture notes.",
        startupNotes: "Startup fixture notes.",
        monitorNotes: "Monitor fixture notes.",
        sleepNotes: "Sleep fixture notes.",
        environmentNotes: "Environment fixture notes.",
        acceptedOutOfScopeBy: options.deferredCheck === undefined &&
          options.conflictedCheck === undefined
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
        manualContextSignature: options.omitReportMetadata === true
          ? undefined
          : `manual-page-smoke-context|2026-05-11T00:00:00.000Z|${signatureBuild}|${signatureInstallerPath}`,
        fields,
        checks,
        deferrals,
        expectedChecks: options.omitReportMetadata === true
          ? undefined
          : reportCheckKeys,
        requiredFields: options.omitReportMetadata === true
          ? undefined
          : [
              "tester",
              "date",
              "windowsVersion",
              "build",
              "monitorSetup",
              "installerPath"
            ],
        requiredEvidenceFields: options.omitReportMetadata === true
          ? undefined
          : [
              { section: "visual", label: "Visual acceptance notes", field: "visualNotes" },
              { section: "installer", label: "Installer notes", field: "installerNotes" },
              { section: "startup", label: "Startup notes", field: "startupNotes" },
              { section: "monitors", label: "Monitor run IDs / notes", field: "monitorNotes" },
              { section: "sleep", label: "Sleep/wake notes", field: "sleepNotes" },
              { section: "environment", label: "Environment notes", field: "environmentNotes" }
            ],
        evidenceFailures: [],
        blockingChecks,
        manualPass: blockingChecks.length === 0,
        exportedAt: options.omitReportMetadata === true
          ? undefined
          : options.exportedAtOverride ?? new Date().toISOString()
      },
      null,
      2
    )
  );
}

function readPackageVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  return packageJson.version;
}

function readCurrentCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    throw new Error(`Unable to read current git commit for smoke fixture: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function readPostBuildCodeChangeCommit() {
  const result = spawnSync(
    "git",
    ["log", "--format=%H", "--max-count=2", "HEAD", "--", "scripts/qa/v2-closeout-audit.mjs"],
    {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: "pipe"
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `Unable to read audit script history for smoke fixture: ${result.stderr.trim()}`
    );
  }

  const commits = result.stdout
    .split(/\r?\n/)
    .map((commit) => commit.trim())
    .filter((commit) => commit.length > 0);
  if (commits.length < 2) {
    throw new Error("Audit script history is too shallow for stale-code smoke coverage.");
  }
  return commits[1];
}

function runAudit(args) {
  return spawnSync("node", [AUDIT_SCRIPT, ...args], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DESKAGOTCHI_QA_RUNS_DIR: SMOKE_QA_RUNS_DIR
    },
    encoding: "utf8",
    stdio: "pipe"
  });
}

main();
