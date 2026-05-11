import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = path.join(ROOT_DIR, ".qa-runs");
const RELEASE_DIR = path.join(ROOT_DIR, "release");
const LATEST_CONTEXT_PATH = path.join(QA_RUNS_DIR, "latest-v2-manual-context.json");
const LATEST_SESSION_PATH = path.join(
  QA_RUNS_DIR,
  "latest-v2-manual-acceptance.html"
);
const MANUAL_PAGE_PATH = path.join(ROOT_DIR, "docs", "qa", "v2-manual-acceptance.html");
const MANUAL_RUNBOOK_PATH = path.join(
  ROOT_DIR,
  "docs",
  "qa",
  "v2-manual-acceptance-runbook.md"
);
const SCENARIO = "manual-context";
const RUN_ID = `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}-${SCENARIO}`;
const RUN_DIR = path.join(QA_RUNS_DIR, RUN_ID);
const ARGS = parseArgs(process.argv.slice(2));
const SCENARIOS = [
  "launch",
  "drag",
  "overlay",
  "play",
  "lifecycle",
  "renderer",
  "idle",
  "release",
  "check",
  "assets-pets",
  "assets-items",
  "manual-page",
  "visual-page",
  "v2-scope"
];

function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const context = buildManualContext(startedAt);
  const summary = buildSummary(context, startedAt);
  const contextPath = path.join(RUN_DIR, "manual-context.json");
  const manualSessionPath = path.join(RUN_DIR, "manual-acceptance-session.html");
  const reportPath = path.join(RUN_DIR, "report.md");
  const summaryPath = path.join(RUN_DIR, "summary.json");

  fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));
  fs.writeFileSync(manualSessionPath, renderManualSessionHtml(context), "utf8");
  fs.copyFileSync(contextPath, LATEST_CONTEXT_PATH);
  fs.copyFileSync(manualSessionPath, LATEST_SESSION_PATH);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(reportPath, renderReport(context, summary), "utf8");

  const openResult = ARGS.open ? openManualSession(LATEST_SESSION_PATH) : null;
  console.log(
    JSON.stringify(
      {
        runId: RUN_ID,
        context: path.relative(ROOT_DIR, contextPath),
        session: path.relative(ROOT_DIR, manualSessionPath),
        latestContext: path.relative(ROOT_DIR, LATEST_CONTEXT_PATH),
        latestSession: path.relative(ROOT_DIR, LATEST_SESSION_PATH),
        latestSessionUrl: pathToLocalFileUrl(LATEST_SESSION_PATH),
        openedLatestSession: openResult?.ok ?? false,
        openError: openResult?.ok === false ? openResult.error : undefined,
        report: path.relative(ROOT_DIR, reportPath),
        summary: path.relative(ROOT_DIR, summaryPath),
        manualPage: context.manualAcceptance.page,
        runbook: context.manualAcceptance.runbook,
        manualGateCount: context.manualAcceptance.gateCount,
        manualPassClaimed: false
      },
      null,
      2
    )
  );
}

function parseArgs(args) {
  return {
    open: args.includes("--open")
  };
}

function buildManualContext(startedAt) {
  const latestRuns = Object.fromEntries(
    SCENARIOS.map((suffix) => [suffix, readLatestRun(suffix)])
  );
  const manualGateKeys = readManualGateKeys();
  const releaseCandidates = findReleaseCandidates();
  const displayTopology = readLatestDisplayTopology(latestRuns.drag?.runId);
  const git = readGitState();
  const fields = {
    tester: "",
    date: startedAt.slice(0, 10),
    windowsVersion: readWindowsVersion(),
    build: `${readPackageVersion()} / ${git.commit}`,
    monitorSetup: summarizeDisplayTopology(displayTopology),
    installerPath: releaseCandidates.installerPath ?? ""
  };

  return {
    generatedAt: startedAt,
    runId: RUN_ID,
    scenario: SCENARIO,
    fields,
    git,
    releaseCandidates,
    manualAcceptance: {
      page: path.relative(ROOT_DIR, MANUAL_PAGE_PATH),
      sessionPage: path.relative(ROOT_DIR, path.join(RUN_DIR, "manual-acceptance-session.html")),
      latestContext: path.relative(ROOT_DIR, LATEST_CONTEXT_PATH),
      latestSessionPage: path.relative(ROOT_DIR, LATEST_SESSION_PATH),
      latestSessionUrl: pathToLocalFileUrl(LATEST_SESSION_PATH),
      runbook: path.relative(ROOT_DIR, MANUAL_RUNBOOK_PATH),
      gateCount: manualGateKeys.length,
      gateKeys: manualGateKeys
    },
    latestRuns,
    displayTopology,
    evidenceNoteStarters: buildEvidenceNoteStarters(
      latestRuns,
      fields,
      releaseCandidates
    ),
    pasteIntoManualPage: buildPasteBlock(fields),
    reminders: [
      "This context does not mark any manual gate as passed.",
      "Use it to fill run context and notes before performing the physical/manual checks.",
      "The generated manual acceptance session page preloads context but does not mark manual gates as passed.",
      "Open .qa-runs/latest-v2-manual-acceptance.html to use the latest generated manual session.",
      "The final exported manual JSON must still come from the manual acceptance page."
    ],
    closeoutCommands: [
      "npm.cmd run qa:v2:audit -- --manual docs\\qa\\v2-manual-acceptance-export.json",
      "git add docs\\qa\\v2-manual-acceptance-export.json docs\\qa\\v2-closeout-report.md",
      "git commit -m \"docs(qa): add v2 manual acceptance evidence\"",
      "npm.cmd run qa:v2:closeout"
    ]
  };
}

function readLatestRun(suffix) {
  const runDirName = findLatestRunDir(suffix);
  if (runDirName === null) {
    return null;
  }

  const summaryPath = path.join(QA_RUNS_DIR, runDirName, "summary.json");
  const summary = readJson(summaryPath);
  return {
    runId: runDirName,
    report: path.relative(
      ROOT_DIR,
      path.join(QA_RUNS_DIR, runDirName, "report.md")
    ),
    confidenceLabel: summary?.confidenceLabel ?? "unknown",
    exactClaimAllowed: summary?.exactClaimAllowed ?? "",
    finishedAt: summary?.finishedAt ?? ""
  };
}

function findLatestRunDir(suffix) {
  if (!fs.existsSync(QA_RUNS_DIR)) {
    return null;
  }

  return fs
    .readdirSync(QA_RUNS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(`-${suffix}`))
    .map((entry) => entry.name)
    .filter((runDirName) => {
      const summary = readJson(path.join(QA_RUNS_DIR, runDirName, "summary.json"));
      return summary !== null && typeof summary.finishedAt === "string";
    })
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function findReleaseCandidates() {
  if (!fs.existsSync(RELEASE_DIR)) {
    return {
      installerPath: null,
      unpackedExecutablePath: null
    };
  }

  const installers = fs
    .readdirSync(RELEASE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".exe"))
    .filter((entry) => entry.name.toLowerCase().includes("setup"))
    .map((entry) => {
      const absolutePath = path.join(RELEASE_DIR, entry.name);
      return {
        relativePath: path.relative(ROOT_DIR, absolutePath),
        modifiedMs: fs.statSync(absolutePath).mtimeMs
      };
    })
    .sort((left, right) => right.modifiedMs - left.modifiedMs);
  const unpackedExecutable = path.join(
    RELEASE_DIR,
    "win-unpacked",
    "Deskagotchi.exe"
  );

  return {
    installerPath: installers[0]?.relativePath ?? null,
    unpackedExecutablePath: fs.existsSync(unpackedExecutable)
      ? path.relative(ROOT_DIR, unpackedExecutable)
      : null
  };
}

function readLatestDisplayTopology(dragRunDirName) {
  if (dragRunDirName === undefined || dragRunDirName === null) {
    return null;
  }
  return readJson(path.join(QA_RUNS_DIR, dragRunDirName, "display-topology.json"));
}

function summarizeDisplayTopology(topology) {
  if (topology === null || !Array.isArray(topology.displays)) {
    return "Unknown; run npm.cmd run qa:desktop:drag and record physical monitor layout.";
  }

  return topology.displays
    .map((display) => {
      const workArea = display.workArea;
      return [
        `display ${display.id}`,
        `${workArea.width}x${workArea.height}+${workArea.x}+${workArea.y}`,
        `scale ${display.scaleFactor}`
      ].join(" ");
    })
    .join("; ");
}

function buildEvidenceNoteStarters(latestRuns, fields, releaseCandidates) {
  return {
    visualNotes: [
      `Automated visual page smoke: ${formatRun(latestRuns["visual-page"])}.`,
      `Built-in pet asset QA: ${formatRun(latestRuns["assets-pets"])}.`,
      `Food and item asset QA: ${formatRun(latestRuns["assets-items"])}.`,
      "Human review still needs pet and food recognizability notes."
    ].join(" "),
    installerNotes: [
      `Automated release smoke: ${formatRun(latestRuns.release)}.`,
      `Installer path: ${fields.installerPath || "not found"}.`,
      `Unpacked executable: ${releaseCandidates.unpackedExecutablePath || "not found"}.`,
      "Add interactive installer and uninstaller observations."
    ].join(" "),
    startupNotes: [
      `Lifecycle QA: ${formatRun(latestRuns.lifecycle)}.`,
      "Add packaged startup-on-login result after real sign out or restart."
    ].join(" "),
    monitorNotes: [
      `Drag QA: ${formatRun(latestRuns.drag)}.`,
      `Monitor setup: ${fields.monitorSetup}.`,
      "Add physical right, stacked, and mixed-DPI observations or deferrals."
    ].join(" "),
    sleepNotes: [
      `Lifecycle QA: ${formatRun(latestRuns.lifecycle)}.`,
      "Add real sleep/wake observation and process check result."
    ].join(" "),
    environmentNotes: [
      "Record RDP, unusual taskbar, and SmartScreen or signing behavior.",
      "Explicitly defer unavailable setups with an approver and rationale."
    ].join(" ")
  };
}

function buildPasteBlock(fields) {
  return Object.entries(fields)
    .map(([fieldName, value]) => `${fieldName}: ${value}`)
    .join("\n");
}

function readManualGateKeys() {
  const manualPage = fs.readFileSync(MANUAL_PAGE_PATH, "utf8");
  const gateKeys = new Set();
  const dataCheckPattern = /<label class="check">\s*<input data-check="([^"]+)"[^>]*\/>\s*<span>.*?<\/span>\s*<\/label>/gs;
  let match = dataCheckPattern.exec(manualPage);

  while (match !== null) {
    gateKeys.add(match[1]);
    match = dataCheckPattern.exec(manualPage);
  }

  return Array.from(gateKeys).sort();
}

function pathToLocalFileUrl(filePath) {
  return pathToFileURL(filePath).href;
}

function openManualSession(filePath) {
  const url = pathToLocalFileUrl(filePath);
  const command = buildOpenCommand(url);
  if (command === null) {
    return {
      ok: false,
      error: `Opening the manual session is not supported on ${process.platform}.`
    };
  }

  const result = spawnSync(command.command, command.args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true
  });
  if (result.status === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    error: result.stderr.trim() || result.stdout.trim() || "Open command failed."
  };
}

function buildOpenCommand(url) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/c", "start", "", url]
    };
  }
  if (process.platform === "darwin") {
    return {
      command: "open",
      args: [url]
    };
  }
  if (process.platform === "linux") {
    return {
      command: "xdg-open",
      args: [url]
    };
  }
  return null;
}

function formatRun(run) {
  if (run === null) {
    return "not found";
  }
  return `${run.runId} (${run.confidenceLabel})`;
}

function readPackageVersion() {
  const packageJson = readJson(path.join(ROOT_DIR, "package.json"));
  return packageJson?.version ?? "unknown-version";
}

function readGitState() {
  const commit = runCommand("git", ["rev-parse", "--short", "HEAD"]).stdout;
  const branch = runCommand("git", ["branch", "--show-current"]).stdout;
  const status = runCommand("git", ["status", "--porcelain=v1"]).stdout;
  const dirtyEntries = status
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  return {
    commit: commit || "unknown-commit",
    branch: branch || "unknown-branch",
    dirty: dirtyEntries.length > 0,
    dirtyEntries
  };
}

function readWindowsVersion() {
  const fallback = `${os.type()} ${os.release()}`;
  if (process.platform !== "win32") {
    return fallback;
  }

  const result = runCommand("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    [
      "$os = Get-CimInstance Win32_OperatingSystem;",
      '"{0} {1} build {2}" -f $os.Caption, $os.Version, $os.BuildNumber'
    ].join(" ")
  ]);
  return result.ok && result.stdout.length > 0 ? result.stdout : fallback;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
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

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function buildSummary(context, startedAt) {
  const checks = [
    {
      name: "manual context collected",
      status: "pass",
      details: {
        build: context.fields.build,
        windowsVersion: context.fields.windowsVersion
      }
    },
    {
      name: "manual acceptance files recorded",
      status: "pass",
      details: context.manualAcceptance
    },
    {
      name: "latest QA run references collected",
      status: "pass",
      details: {
        foundRuns: Object.values(context.latestRuns).filter(Boolean).length,
        expectedRuns: SCENARIOS.length
      }
    },
    {
      name: "release candidate paths recorded",
      status: "pass",
      details: context.releaseCandidates
    },
    {
      name: "monitor topology summarized",
      status: "pass",
      details: {
        monitorSetup: context.fields.monitorSetup
      }
    },
    {
      name: "evidence note starters generated",
      status: "pass",
      details: {
        fields: Object.keys(context.evidenceNoteStarters)
      }
    }
  ];

  return {
    scenario: SCENARIO,
    runId: RUN_ID,
    startedAt,
    finishedAt: new Date().toISOString(),
    confidenceLabel: "manual-prep",
    evidenceTier: "local-context",
    checks,
    artifacts: [
      "manual-context.json",
      "manual-acceptance-session.html",
      "summary.json",
      "report.md"
    ],
    exactClaimAllowed:
      "manual acceptance context collected; this is not a manual pass",
    uncoveredConditions: [
      "physical manual gate execution",
      "human subjective signoff",
      "interactive installer UI",
      "real startup-on-login",
      "real sleep/wake",
      "manual multi-monitor layouts not present on this machine"
    ]
  };
}

function renderReport(context, summary) {
  const latestRunRows = Object.entries(context.latestRuns)
    .map(([scenario, run]) =>
      run === null
        ? `| ${scenario} | missing |  |  |`
        : `| ${scenario} | ${run.runId} | ${run.confidenceLabel} | ${run.report} |`
    )
    .join("\n");
  const fieldRows = Object.entries(context.fields)
    .map(([field, value]) => `| ${field} | ${value || "missing"} |`)
    .join("\n");
  const releaseRows = Object.entries(context.releaseCandidates)
    .map(([field, value]) => `| ${field} | ${value ?? "missing"} |`)
    .join("\n");
  const noteRows = Object.entries(context.evidenceNoteStarters)
    .map(([field, value]) => `| ${field} | ${value} |`)
    .join("\n");
  const closeoutCommandRows = context.closeoutCommands
    .map((command) => `\`\`\`powershell\n${command}\n\`\`\``)
    .join("\n\n");
  const dirtyRows = context.git.dirtyEntries.length === 0
    ? "- None"
    : context.git.dirtyEntries.map((entry) => `- \`${entry}\``).join("\n");

  return `# Deskagotchi V2 Manual Context

Run ID: ${context.runId}

Generated: ${context.generatedAt}

Confidence: ${summary.confidenceLabel}

Exact claim allowed: ${summary.exactClaimAllowed}

This artifact prepares manual acceptance context. It does not mark manual gates
as passed.

## Suggested Fields

| Field | Value |
| --- | --- |
${fieldRows}

## Paste Starter

\`\`\`text
${context.pasteIntoManualPage}
\`\`\`

## Manual Acceptance Files

| File | Path |
| --- | --- |
| Manual page | ${context.manualAcceptance.page} |
| Generated session page | ${context.manualAcceptance.sessionPage} |
| Latest session page | ${context.manualAcceptance.latestSessionPage} |
| Latest context JSON | ${context.manualAcceptance.latestContext} |
| Runbook | ${context.manualAcceptance.runbook} |

Latest session URL: ${context.manualAcceptance.latestSessionUrl}

Manual gate count: ${context.manualAcceptance.gateCount}

## Git State

Branch: \`${context.git.branch}\`

Commit: \`${context.git.commit}\`

Dirty: ${context.git.dirty ? "yes" : "no"}

${dirtyRows}

## Release Candidates

| Candidate | Path |
| --- | --- |
${releaseRows}

## Latest QA Runs

| Scenario | Run ID | Confidence | Report |
| --- | --- | --- | --- |
${latestRunRows}

## Evidence Note Starters

| Field | Starter |
| --- | --- |
${noteRows}

## Reminders

${context.reminders.map((reminder) => `- ${reminder}`).join("\n")}

## Closeout Commands After Export

${closeoutCommandRows}

## Uncovered Conditions

${summary.uncoveredConditions.map((condition) => `- ${condition}`).join("\n")}
`;
}

function renderManualSessionHtml(context) {
  const manualPage = fs.readFileSync(MANUAL_PAGE_PATH, "utf8");
  const contextJson = JSON.stringify(context, null, 2).replace(/</g, "\\u003c");
  const placeholder =
    '<script id="deskagotchi-manual-context" type="application/json"></script>';
  if (!manualPage.includes(placeholder)) {
    throw new Error("Manual page is missing the embedded context placeholder.");
  }

  return manualPage.replace(
    placeholder,
    `<script id="deskagotchi-manual-context" type="application/json">\n${contextJson}\n</script>`
  );
}

main();
