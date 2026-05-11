import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = resolveQaRunsDir();
const ARGS = parseArgs(process.argv.slice(2));
const REPORT_PATH = path.isAbsolute(ARGS.reportPath)
  ? ARGS.reportPath
  : path.join(ROOT_DIR, ARGS.reportPath);

const AUTOMATED_SCENARIOS = [
  {
    key: "launch",
    label: "Launch",
    suffix: "launch",
    requiredChecks: [
      "no existing non-QA Deskagotchi process detected",
      "electron launched",
      "overlay rendered pet sprite",
      "userData path is isolated",
      "overlay window role detected"
    ]
  },
  {
    key: "drag",
    label: "Drag and current multi-monitor layout",
    suffix: "drag",
    requiredChecks: [
      "OS drag moved native overlay bounds",
      "drag did not leave care menu closed",
      "drag bounds persisted to QA save",
      "relaunch restored persisted pet position"
    ],
    notableChecks: ["OS drag crossed onto negative-coordinate monitor"]
  },
  {
    key: "overlay",
    label: "Overlay care interactions",
    suffix: "overlay",
    requiredChecks: [
      "overlay menu opened",
      "feed picker shows scoped food choices",
      "meal eating feedback uses selected food cue",
      "snack eating feedback uses selected food cue",
      "health opens compact overlay card",
      "overlay health did not open a panel window"
    ]
  },
  {
    key: "play",
    label: "Ball play mode",
    suffix: "play",
    requiredChecks: [
      "play mode expanded overlay bounds",
      "play stage has no visible boundary",
      "play controls and sprites are desktop-readable",
      "play exit restored compact overlay size"
    ]
  },
  {
    key: "lifecycle",
    label: "Lifecycle, always-on-top, resume, unlock",
    suffix: "lifecycle",
    requiredChecks: [
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
    key: "renderer",
    label: "Renderer panel routes",
    suffix: "renderer",
    requiredChecks: [
      "panel route status rendered",
      "panel route pet-selector rendered",
      "panel route settings rendered"
    ]
  },
  {
    key: "idle",
    label: "Five-minute idle CPU",
    suffix: "idle",
    requiredChecks: ["idle CPU stayed below threshold"],
    extraValidator: validateIdleCpu
  },
  {
    key: "release",
    label: "Packaged release and installer smoke",
    suffix: "release",
    requiredChecks: [
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
    key: "manual-page",
    label: "Manual acceptance page export",
    suffix: "manual-page",
    requiredChecks: [
      "manual acceptance page loaded",
      "manual gate count matched",
      "blank run context blocks manual pass",
      "manual context import prefills without resolving gates",
      "all gates without run context blocks manual pass",
      "all gates with run context exports manual pass",
      "deferral without approver blocks manual pass",
      "deferral with approver exports manual pass",
      "manual acceptance screenshot captured"
    ]
  },
  {
    key: "visual-page",
    label: "V2 visual acceptance pages",
    suffix: "visual-page",
    requiredChecks: [
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
    key: "v2-scope",
    label: "V2 user-facing scope",
    suffix: "v2-scope",
    requiredChecks: [
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

const REQUIRED_ARTIFACTS = [
  {
    label: "V2 goal success criteria",
    path: "docs/v2-goal-success-criteria.md"
  },
  {
    label: "V2 roadmap",
    path: "docs/qa/deskagotchi-v2-roadmap.html"
  },
  {
    label: "V2 completion audit",
    path: "docs/qa/v2-completion-audit.md"
  },
  {
    label: "Desktop hardening plan",
    path: "docs/qa/desktop-hardening-v2.md"
  },
  {
    label: "Simulation maintenance docs",
    path: "docs/simulation/care-simulation-v2.md"
  },
  {
    label: "Food icon standards",
    path: "docs/design/lcd-food-icon-standards.md"
  },
  {
    label: "Pet animation gallery",
    path: "docs/qa/pet-animation-gallery.html"
  },
  {
    label: "V2 visual acceptance page",
    path: "docs/qa/v2-visual-acceptance.html"
  },
  {
    label: "V2 visual acceptance screenshot",
    path: "docs/qa/v2-visual-acceptance-screenshot.png"
  },
  {
    label: "V2 visual review notes",
    path: "docs/qa/v2-visual-review-notes.md"
  },
  {
    label: "V2 manual acceptance page",
    path: "docs/qa/v2-manual-acceptance.html"
  },
  {
    label: "V2 manual acceptance runbook",
    path: "docs/qa/v2-manual-acceptance-runbook.md"
  },
  {
    label: "V2 manual acceptance screenshot",
    path: "docs/qa/v2-manual-acceptance-screenshot.png"
  },
  {
    label: "Food icon contact sheet",
    path: "docs/qa/lcd-food-icons-contact-sheet.png"
  },
  {
    label: "Full item icon contact sheet",
    path: "docs/qa/lcd-item-icons-contact-sheet.png"
  },
  {
    label: "Bao contact sheet",
    path: "docs/qa/bao-contact-sheet.png"
  },
  {
    label: "Miso contact sheet",
    path: "docs/qa/miso-contact-sheet.png"
  },
  {
    label: "Mochi contact sheet",
    path: "docs/qa/mochi-contact-sheet.png"
  },
  {
    label: "Peanut contact sheet",
    path: "docs/qa/peanut-contact-sheet.png"
  },
  {
    label: "Puddles contact sheet",
    path: "docs/qa/puddles-contact-sheet.png"
  }
];

const MANUAL_ACCEPTANCE_PATHS = [
  "docs/qa/v2-manual-acceptance.json",
  "docs/qa/v2-manual-acceptance-export.json"
];

const REQUIRED_MANUAL_FIELDS = [
  "tester",
  "date",
  "windowsVersion",
  "build",
  "monitorSetup",
  "installerPath"
];

const REQUIRED_MANUAL_EVIDENCE_FIELDS = [
  ["visual", "visualNotes"],
  ["installer", "installerNotes"],
  ["startup", "startupNotes"],
  ["monitors", "monitorNotes"],
  ["sleep", "sleepNotes"],
  ["environment", "environmentNotes"]
];

function resolveQaRunsDir() {
  const configuredPath = process.env.DESKAGOTCHI_QA_RUNS_DIR;
  if (configuredPath === undefined || configuredPath.trim().length === 0) {
    return path.join(ROOT_DIR, ".qa-runs");
  }
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(ROOT_DIR, configuredPath);
}

const V2_DELIVERABLES = [
  "Companion surface: compact transparent pet overlay, in-place care controls, click and drag behavior.",
  "Built-in pet quality: Bao, Miso, Mochi, Peanut, and Puddles with coherent LCD assets and full animation rows.",
  "Food and item experience: icon-first feeding, recognizable food assets, and selected-food eating cues.",
  "Care simulation: deterministic, documented, day-scale progression with tested action effects and offline catch-up.",
  "Deferred custom generation: user-facing Hatch is out of the V2 promise while package safety boundaries remain.",
  "Desktop hardening: launch, drag, recovery, multi-monitor bounds, always-on-top, sleep/wake, play, and cleanup evidence.",
  "Package and data safety: package validation, archive safety, atomic saves, backup recovery, and relaunch persistence.",
  "Packaging readiness: Windows build, installer resources, release smoke, idle CPU, and manual installer/startup acceptance."
];

const PROMPT_TO_ARTIFACT_CHECKLIST = [
  {
    requirement: "Launch opens the compact transparent pet overlay by default.",
    evidence: "latest launch QA report",
    automatedKeys: ["launch"]
  },
  {
    requirement: "Normal care actions stay in the overlay and health does not open a stuck panel.",
    evidence: "latest overlay QA report",
    automatedKeys: ["overlay"]
  },
  {
    requirement: "Feed picker uses icon-first food choices and selected food appears in eating feedback.",
    evidence: "overlay QA plus item contact sheets",
    automatedKeys: ["overlay", "visual-page"],
    artifactLabels: ["Food icon contact sheet", "Full item icon contact sheet"],
    manualRequired: true
  },
  {
    requirement: "Ball play expands to the monitor work area and restores the compact overlay.",
    evidence: "latest play QA report",
    automatedKeys: ["play"]
  },
  {
    requirement: "Pet dragging works by the visible sprite and persists restored bounds.",
    evidence: "latest drag QA report",
    automatedKeys: ["drag"],
    manualRequired: true
  },
  {
    requirement: "Multi-monitor bounds logic covers right, left, stacked, largest-intersection, and fallback layouts.",
    evidence: "src/main/windowBounds.test.ts through npm.cmd run check",
    artifactPaths: ["src/main/windowBounds.test.ts", "docs/architecture/pet-overlay-boundaries.md"]
  },
  {
    requirement: "Built-in roster and animation assets are ready for Bao, Miso, Mochi, Peanut, and Puddles.",
    evidence: "pet asset contact sheets and visual acceptance page",
    automatedKeys: ["visual-page"],
    artifactLabels: [
      "Bao contact sheet",
      "Miso contact sheet",
      "Mochi contact sheet",
      "Peanut contact sheet",
      "Puddles contact sheet",
      "V2 visual acceptance page",
      "V2 visual review notes"
    ],
    manualRequired: true
  },
  {
    requirement: "Care simulation is deterministic, documented, and tested for V2 rules.",
    evidence: "simulation docs and test suite through npm.cmd run check",
    artifactPaths: ["docs/simulation/care-simulation-v2.md", "src/shared/simulation.test.ts"]
  },
  {
    requirement: "Custom generation is deferred from user-facing V2 while package boundaries remain.",
    evidence: "README, renderer route removal, and V2 scope QA",
    automatedKeys: ["v2-scope"],
    artifactPaths: ["README.md", "src/shared/hatch.ts", "src/shared/ipc.ts"]
  },
  {
    requirement: "Always-on-top, reset position, resume, unlock, and startup setting safety are covered.",
    evidence: "latest lifecycle QA report",
    automatedKeys: ["lifecycle"]
  },
  {
    requirement: "Low idle CPU has a five-minute automated observation.",
    evidence: "latest idle QA report",
    automatedKeys: ["idle"]
  },
  {
    requirement: "Windows packaging includes runtime resources and installer smoke evidence.",
    evidence: "latest release QA report",
    automatedKeys: ["release"],
    manualRequired: true
  },
  {
    requirement: "Manual physical gates are either tested and passed or explicitly deferred with rationale.",
    evidence: "V2 manual acceptance JSON",
    automatedKeys: ["manual-page"],
    manualOnly: true,
    manualRequired: true
  }
];

function main() {
  const generatedAt = new Date().toISOString();
  const scenarioResults = AUTOMATED_SCENARIOS.map(auditScenario);
  const artifactResults = REQUIRED_ARTIFACTS.map(auditArtifact);
  const manualResult = auditManualAcceptance();
  const workspaceResult = auditWorkspaceState();

  const automatedPassed = scenarioResults.every((result) => result.status === "pass");
  const artifactsPassed = artifactResults.every((result) => result.status === "pass");
  const manualPassed = manualResult.status === "pass";
  const workspacePassed = workspaceResult.status === "pass";
  const completionStatus = automatedPassed && artifactsPassed && manualPassed && workspacePassed
    ? "complete"
    : "incomplete";

  const report = renderReport({
    generatedAt,
    completionStatus,
    scenarioResults,
    artifactResults,
    manualResult,
    workspaceResult,
    checklistResults: auditPromptChecklist(scenarioResults, artifactResults, manualResult)
  });

  if (ARGS.checkOnly) {
    console.log("V2 closeout audit ran in check-only mode; report was not written.");
  } else {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, report);
    console.log(`V2 closeout audit written to ${path.relative(ROOT_DIR, REPORT_PATH)}`);
  }
  console.log(`Completion status: ${completionStatus}`);

  if (ARGS.strict && completionStatus !== "complete") {
    process.exit(1);
  }
}

function parseArgs(args) {
  const parsed = {
    allowDirty: false,
    checkOnly: false,
    strict: false,
    manualPath: null,
    reportPath: path.join("docs", "qa", "v2-closeout-report.md")
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--strict") {
      parsed.strict = true;
      continue;
    }
    if (arg === "--allow-dirty") {
      parsed.allowDirty = true;
      continue;
    }
    if (arg === "--check-only" || arg === "--no-write") {
      parsed.checkOnly = true;
      continue;
    }
    if (arg === "--manual") {
      const manualPath = args[index + 1];
      if (manualPath === undefined || manualPath.startsWith("--")) {
        throw new Error("--manual requires a JSON path.");
      }
      parsed.manualPath = manualPath;
      index += 1;
      continue;
    }
    if (arg === "--report") {
      const reportPath = args[index + 1];
      if (reportPath === undefined || reportPath.startsWith("--")) {
        throw new Error("--report requires a Markdown report path.");
      }
      parsed.reportPath = reportPath;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function auditScenario(scenario) {
  const runDir = findLatestRunDir(scenario.suffix);
  if (runDir === null) {
    return failScenario(scenario, "No QA run directory found.");
  }

  const summaryPath = path.join(QA_RUNS_DIR, runDir, "summary.json");
  const summary = readJson(summaryPath);
  if (summary === null) {
    return failScenario(scenario, "summary.json missing or invalid.", runDir);
  }

  const checks = Array.isArray(summary.checks) ? summary.checks : [];
  const failedChecks = checks
    .filter((check) => check.status !== "pass")
    .map((check) => check.name);
  const missingChecks = scenario.requiredChecks.filter(
    (name) => !checks.some((check) => check.name === name && check.status === "pass")
  );
  const notableChecks = (scenario.notableChecks ?? []).filter(
    (name) => checks.some((check) => check.name === name && check.status === "pass")
  );
  const extraFailures = scenario.extraValidator?.(runDir, summary) ?? [];
  const failures = [
    ...failedChecks.map((name) => `failed check: ${name}`),
    ...missingChecks.map((name) => `missing check: ${name}`),
    ...extraFailures
  ];
  const confidencePass = summary.confidenceLabel === "automated-pass";

  if (!confidencePass) {
    failures.push(`unexpected confidence label: ${summary.confidenceLabel ?? "missing"}`);
  }

  return {
    key: scenario.key,
    label: scenario.label,
    status: failures.length === 0 ? "pass" : "fail",
    runId: runDir,
    confidenceLabel: summary.confidenceLabel ?? "missing",
    evidenceTier: summary.evidenceTier ?? "not recorded",
    exactClaimAllowed: summary.exactClaimAllowed ?? "not recorded",
    uncoveredConditions: summary.uncoveredConditions ?? [],
    notableChecks,
    failures
  };
}

function auditArtifact(artifact) {
  const absolutePath = path.join(ROOT_DIR, artifact.path);
  const exists = fs.existsSync(absolutePath);
  return {
    ...artifact,
    status: exists ? "pass" : "fail"
  };
}

function auditWorkspaceState() {
  const commit = runGit(["rev-parse", "--short", "HEAD"]);
  const status = runGit(["status", "--porcelain=v1"]);
  const dirtyEntries = status.ok
    ? status.stdout.split(/\r?\n/).filter((line) => line.trim().length > 0)
    : [];
  const dirtyCount = dirtyEntries.length;

  if (!commit.ok || !status.ok) {
    return {
      status: "fail",
      commit: commit.stdout || "unknown",
      dirtyCount,
      dirtyEntries,
      summary: "Git workspace state could not be read."
    };
  }

  if (dirtyCount === 0) {
    return {
      status: "pass",
      commit: commit.stdout,
      dirtyCount,
      dirtyEntries,
      summary: "Workspace is clean."
    };
  }

  return {
    status: ARGS.allowDirty ? "pass" : "fail",
    commit: commit.stdout,
    dirtyCount,
    dirtyEntries,
    summary: ARGS.allowDirty
      ? "Workspace is dirty, but --allow-dirty was provided."
      : "Workspace is dirty; closeout evidence may be stale relative to local changes."
  };
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: "pipe"
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

function auditPromptChecklist(scenarioResults, artifactResults, manualResult) {
  return PROMPT_TO_ARTIFACT_CHECKLIST.map((item) => {
    const automatedFailures = (item.automatedKeys ?? [])
      .filter((key) => !scenarioPassed(scenarioResults, key))
      .map((key) => `missing automated pass: ${key}`);
    const artifactLabelFailures = (item.artifactLabels ?? [])
      .filter((label) => !artifactLabelPassed(artifactResults, label))
      .map((label) => `missing artifact: ${label}`);
    const artifactPathFailures = (item.artifactPaths ?? [])
      .filter((artifactPath) => !fs.existsSync(path.join(ROOT_DIR, artifactPath)))
      .map((artifactPath) => `missing path: ${artifactPath}`);
    const failures = [
      ...automatedFailures,
      ...artifactLabelFailures,
      ...artifactPathFailures
    ];

    if (failures.length > 0) {
      return {
        ...item,
        status: "fail",
        notes: failures
      };
    }

    if ((item.manualOnly === true || item.manualRequired === true) && manualResult.status !== "pass") {
      return {
        ...item,
        status: "manual-open",
        notes: ["manual acceptance JSON is not passing yet"]
      };
    }

    return {
      ...item,
      status: "pass",
      notes: []
    };
  });
}

function scenarioPassed(scenarioResults, key) {
  return scenarioResults.some((result) => result.key === key && result.status === "pass");
}

function artifactLabelPassed(artifactResults, label) {
  return artifactResults.some((result) => result.label === label && result.status === "pass");
}

function auditManualAcceptance() {
  const manualPaths = ARGS.manualPath === null
    ? MANUAL_ACCEPTANCE_PATHS
    : [ARGS.manualPath];
  const expectedChecks = readExpectedManualChecks();
  const expectedCheckKeys = expectedChecks.map((check) => check.key);
  const expectedCheckByKey = new Map(
    expectedChecks.map((check) => [check.key, check])
  );

  for (const manualPath of manualPaths) {
    const absolutePath = path.isAbsolute(manualPath)
      ? manualPath
      : path.join(ROOT_DIR, manualPath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const manualReport = readJson(absolutePath);
    if (manualReport === null) {
      return {
        status: "fail",
        path: normalizeManualPath(absolutePath),
        summary: "Manual acceptance JSON exists but could not be parsed.",
        blockingChecks: ["Manual acceptance JSON could not be parsed."]
      };
    }

    const acceptedOutOfScopeBy = getManualField(manualReport, "acceptedOutOfScopeBy");
    const hasDeferrals = expectedCheckKeys.some(
      (checkKey) => manualReport.deferrals?.[checkKey]?.accepted === true
    );
    const fieldFailures = REQUIRED_MANUAL_FIELDS
      .filter((fieldName) => !hasNonEmptyManualField(manualReport, fieldName))
      .map((fieldName) => `Missing manual context field: ${fieldName}`);
    if (hasDeferrals && acceptedOutOfScopeBy.length === 0) {
      fieldFailures.push("Missing manual context field: acceptedOutOfScopeBy");
    }
    const computedEvidenceFailures = REQUIRED_MANUAL_EVIDENCE_FIELDS
      .filter(([section]) => isManualSectionTouched(manualReport, section, expectedCheckKeys))
      .filter(([, fieldName]) => !hasNonEmptyManualField(manualReport, fieldName))
      .map(([, fieldName]) => `Missing manual evidence note: ${fieldName}`);
    const reportedEvidenceFailures = Array.isArray(manualReport.evidenceFailures)
      ? manualReport.evidenceFailures.map((failure) => `Reported evidence failure: ${failure}`)
      : [];
    const evidenceFailures = [
      ...computedEvidenceFailures,
      ...reportedEvidenceFailures
    ];
    const checkFailures = expectedChecks
      .filter((check) => !isManualGateResolved(manualReport, check.key, acceptedOutOfScopeBy))
      .map((check) => `Missing, unchecked, or unresolved manual gate: ${formatManualCheck(check)}`);
    const blockingChecks = [
      ...fieldFailures,
      ...evidenceFailures,
      ...checkFailures,
      ...(manualReport.blockingChecks ?? []).map(
        (checkKey) => `Reported blocking check: ${formatManualCheck(
          expectedCheckByKey.get(checkKey) ?? { key: checkKey, label: "Unknown manual gate." }
        )}`
      )
    ];

    if (manualReport.manualPass === true && blockingChecks.length === 0) {
      return {
        status: "pass",
        path: normalizeManualPath(absolutePath),
        summary: `Manual acceptance JSON covers ${expectedCheckKeys.length} checks and required run context.`,
        blockingChecks: []
      };
    }

    return {
      status: "fail",
      path: normalizeManualPath(absolutePath),
      summary: "Manual acceptance JSON exists but is incomplete.",
      blockingChecks: blockingChecks.length === 0
        ? ["manualPass is not true."]
        : blockingChecks
    };
  }

  return {
    status: "manual-open",
    path: null,
    summary: "No exported manual acceptance JSON found.",
    blockingChecks: expectedChecks.map(
      (check) => `Manual gate not exported: ${formatManualCheck(check)}`
    )
  };
}

function readExpectedManualChecks() {
  const manualPagePath = path.join(ROOT_DIR, "docs", "qa", "v2-manual-acceptance.html");
  const manualPage = fs.readFileSync(manualPagePath, "utf8");
  const checks = new Map();
  const dataCheckPattern = /<label class="check">\s*<input data-check="([^"]+)"[^>]*\/>\s*<span>(.*?)<\/span>\s*<\/label>/gs;
  let match = dataCheckPattern.exec(manualPage);

  while (match !== null) {
    checks.set(match[1], normalizeHtmlText(match[2]));
    match = dataCheckPattern.exec(manualPage);
  }

  return Array.from(checks)
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function normalizeHtmlText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function formatManualCheck(check) {
  return `${check.key}: ${check.label}`;
}

function hasNonEmptyManualField(manualReport, fieldName) {
  return getManualField(manualReport, fieldName).length > 0;
}

function isManualSectionTouched(manualReport, section, expectedCheckKeys) {
  return expectedCheckKeys
    .filter((checkKey) => checkKey.startsWith(`${section}.`))
    .some(
      (checkKey) =>
        manualReport.checks?.[checkKey] === true ||
        manualReport.deferrals?.[checkKey]?.accepted === true
    );
}

function getManualField(manualReport, fieldName) {
  const value = manualReport.fields?.[fieldName];
  return typeof value === "string" ? value.trim() : "";
}

function isManualGateResolved(manualReport, checkKey, acceptedOutOfScopeBy) {
  if (manualReport.checks?.[checkKey] === true) {
    return true;
  }

  const deferral = manualReport.deferrals?.[checkKey];
  if (deferral?.accepted !== true) {
    return false;
  }

  const rationale = typeof deferral.rationale === "string"
    ? deferral.rationale.trim()
    : "";
  return acceptedOutOfScopeBy.length > 0 && rationale.length > 0;
}

function normalizeManualPath(absolutePath) {
  return path.relative(ROOT_DIR, absolutePath).replaceAll(path.sep, "/");
}

function validateIdleCpu(runDir, summary) {
  const checks = Array.isArray(summary.checks) ? summary.checks : [];
  const idleCpuCheck = checks.find(
    (check) => check.name === "idle CPU stayed below threshold"
  );
  const details = idleCpuCheck?.details;
  if (details === undefined) {
    return ["idle CPU check did not include details"];
  }

  const failures = [];
  if (details.durationSeconds < 300) {
    failures.push(`idle duration was ${details.durationSeconds}s, expected at least 300s`);
  }
  if (details.cpuPercentOfOneCore > details.limitPercentOfOneCore) {
    failures.push(
      `idle CPU was ${details.cpuPercentOfOneCore}%, limit ${details.limitPercentOfOneCore}%`
    );
  }

  const idleCpuPath = path.join(QA_RUNS_DIR, runDir, "idle-cpu.json");
  if (!fs.existsSync(idleCpuPath)) {
    failures.push("idle-cpu.json artifact missing");
  }

  return failures;
}

function findLatestRunDir(suffix) {
  if (!fs.existsSync(QA_RUNS_DIR)) {
    return null;
  }

  const runDirs = fs
    .readdirSync(QA_RUNS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(`-${suffix}`))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));
  return runDirs.find(hasCompleteSummary) ?? null;
}

function hasCompleteSummary(runDir) {
  const summary = readJson(path.join(QA_RUNS_DIR, runDir, "summary.json"));
  return (
    summary !== null &&
    typeof summary.finishedAt === "string" &&
    Array.isArray(summary.checks)
  );
}

function failScenario(scenario, failure, runId = null) {
  return {
    key: scenario.key,
    label: scenario.label,
    status: "fail",
    runId,
    confidenceLabel: "missing",
    evidenceTier: "missing",
    exactClaimAllowed: "none",
    uncoveredConditions: [],
    notableChecks: [],
    failures: [failure]
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function renderReport({
  generatedAt,
  completionStatus,
  scenarioResults,
  artifactResults,
  manualResult,
  workspaceResult,
  checklistResults
}) {
  const scenarioRows = scenarioResults
    .map((result) => {
      const runPath = result.runId === null
        ? "missing"
        : `.qa-runs/${result.runId}/report.md`;
      const notes = [
        result.exactClaimAllowed,
        ...result.notableChecks.map((check) => `notable: ${check}`),
        ...result.failures
      ].join("<br />");
      return `| ${result.label} | ${formatStatus(result.status)} | ${runPath} | ${result.confidenceLabel} | ${notes} |`;
    })
    .join("\n");

  const artifactRows = artifactResults
    .map((result) => (
      `| ${result.label} | ${formatStatus(result.status)} | \`${result.path}\` |`
    ))
    .join("\n");

  const manualRows = manualResult.blockingChecks
    .map((blocker) => `- ${blocker}`)
    .join("\n");
  const deliverableRows = V2_DELIVERABLES
    .map((deliverable) => `- ${deliverable}`)
    .join("\n");
  const checklistRows = checklistResults
    .map((result) => {
      const notes = result.notes.length === 0 ? "" : result.notes.join("<br />");
      return `| ${result.requirement} | ${formatChecklistStatus(result.status)} | ${result.evidence} | ${notes} |`;
    })
    .join("\n");
  const dirtyRows = workspaceResult.dirtyEntries.length === 0
    ? "- None"
    : workspaceResult.dirtyEntries
        .slice(0, 40)
        .map((entry) => `- \`${entry}\``)
        .join("\n");
  const dirtyOverflow = workspaceResult.dirtyEntries.length > 40
    ? `\n- ...and ${workspaceResult.dirtyEntries.length - 40} more entries`
    : "";
  const allowedClaim = completionStatus === "complete"
    ? "Deskagotchi V2 has automated and manual closeout evidence for the documented Windows scope."
    : "Deskagotchi V2 has strong automated evidence for the tested Windows scope, but it is not a full V2 completion claim until the manual gates below pass.";

  return `# Deskagotchi V2 Closeout Report

Generated: ${generatedAt}

Completion status: **${completionStatus}**

## Exact Current Claim

${allowedClaim}

## Concrete V2 Deliverables

${deliverableRows}

## Automated Evidence

| Area | Status | Latest evidence | Confidence | Notes |
| --- | --- | --- | --- | --- |
${scenarioRows}

## Prompt-To-Artifact Checklist

| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
${checklistRows}

## Workspace State

Status: **${formatStatus(workspaceResult.status)}**

Commit: \`${workspaceResult.commit}\`

${workspaceResult.summary}

Dirty entries: ${workspaceResult.dirtyCount}

${dirtyRows}${dirtyOverflow}

## Required Artifacts

| Artifact | Status | Path |
| --- | --- | --- |
${artifactRows}

## Manual Acceptance

Status: **${manualResult.status}**

Evidence path: ${manualResult.path === null ? "not exported yet" : `\`${manualResult.path}\``}

${manualResult.summary}

${manualRows}

## Strict Mode

Run this audit with strict mode when preparing a release branch:

\`\`\`powershell
npm.cmd run qa:v2:closeout
\`\`\`

Use \`--check-only\` for final release validation so the tracked report does not
get rewritten during the clean-worktree gate. Run without \`--check-only\` when
you intentionally want to refresh this Markdown report artifact.

Use an exported manual acceptance file from another location when needed:

\`\`\`powershell
npm.cmd run qa:v2:audit -- --manual C:\\path\\to\\v2-manual-acceptance-export.json
\`\`\`

Use a separate report path for fixture or release-candidate checks:

\`\`\`powershell
npm.cmd run qa:v2:audit -- --manual C:\\path\\to\\v2-manual-acceptance-export.json --report .qa-runs\\v2-closeout-report.md
\`\`\`

Use \`--allow-dirty\` only for fixture smoke checks that intentionally run
against a dirty local tree.

Strict mode exits non-zero until automated evidence, required artifacts, and
manual acceptance JSON are all present, passing, and the workspace is clean.
`;
}

function formatStatus(status) {
  return status === "pass" ? "PASS" : "FAIL";
}

function formatChecklistStatus(status) {
  if (status === "pass") {
    return "PASS";
  }
  if (status === "manual-open") {
    return "MANUAL OPEN";
  }
  return "FAIL";
}

main();
