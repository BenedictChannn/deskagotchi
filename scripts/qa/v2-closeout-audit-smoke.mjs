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
    suffix: "manual-page",
    checks: [
      "manual acceptance page loaded",
      "manual gate count matched",
      "blank run context blocks manual pass",
      "embedded manual context prefills without resolving gates",
      "manual context import prefills without resolving gates",
      "same manual context import preserves current gate decisions",
      "new manual context import resets stale gate decisions",
      "all gates without run context blocks manual pass",
      "all gates with run context exports manual pass",
      "deferral without approver blocks manual pass",
      "deferral with approver exports manual pass",
      "manual acceptance screenshot captured"
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
  if (!missingFieldsReport.includes("Missing manual evidence note: visualNotes")) {
    throw new Error("Missing-fields report did not include required evidence-note blockers.");
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
    "manualPass: blockingChecks.length === 0 && fieldFailures.length === 0 && evidenceFailures.length === 0",
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
        installerPath: "release/Deskagotchi Setup 0.1.0.exe",
        visualNotes: "Visual fixture notes.",
        installerNotes: "Installer fixture notes.",
        startupNotes: "Startup fixture notes.",
        monitorNotes: "Monitor fixture notes.",
        sleepNotes: "Sleep fixture notes.",
        environmentNotes: "Environment fixture notes.",
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
        evidenceFailures: [],
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
    env: {
      ...process.env,
      DESKAGOTCHI_QA_RUNS_DIR: SMOKE_QA_RUNS_DIR
    },
    encoding: "utf8",
    stdio: "pipe"
  });
}

main();
