import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { launchQaBrowser } from "./browser-smoke-utils.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = path.join(ROOT_DIR, ".qa-runs");
const PAGE_PATH = path.join(ROOT_DIR, "docs", "qa", "v2-manual-acceptance.html");
const SCREENSHOT_PATH = path.join(
  ROOT_DIR,
  "docs",
  "qa",
  "v2-manual-acceptance-screenshot.png"
);
const RUN_ID = `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}-manual-page`;
const RUN_DIR = path.join(QA_RUNS_DIR, RUN_ID);
const SESSION_PAGE_PATH = path.join(RUN_DIR, "manual-acceptance-session.html");
const UPDATE_SCREENSHOT = process.argv.includes("--update-screenshot");
const REQUIRED_FIELD_FIXTURE = {
  tester: "V2 manual page smoke",
  date: "2026-05-11",
  windowsVersion: "Windows smoke fixture",
  build: "manual-page-smoke",
  monitorSetup: "single-display smoke fixture",
  installerPath: "release/Deskagotchi Setup 0.1.0.exe"
};
const REQUIRED_EVIDENCE_NOTE_FIXTURE = {
  visualNotes: "Visual acceptance smoke evidence notes.",
  installerNotes: "Installer smoke evidence notes.",
  startupNotes: "Startup smoke evidence notes.",
  monitorNotes: "Monitor smoke evidence notes.",
  sleepNotes: "Sleep/wake smoke evidence notes.",
  environmentNotes: "Environment smoke evidence notes."
};
const MANUAL_CONTEXT_FIXTURE = {
  runId: "manual-page-smoke-context",
  generatedAt: "2026-05-11T00:00:00.000Z",
  fields: REQUIRED_FIELD_FIXTURE,
  evidenceNoteStarters: REQUIRED_EVIDENCE_NOTE_FIXTURE
};

async function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const checks = [];
  const artifacts = [];
  const browser = await launchQaBrowser("manual acceptance page smoke");
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1600 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  try {
    await page.goto(pathToFileURL(PAGE_PATH).href, {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    await page.locator("#export-status").waitFor({ state: "visible", timeout: 10000 });
    recordPass(checks, "manual acceptance page loaded");

    const closeoutTargetText = await page.locator(".section").filter({
      hasText: "Closeout Target"
    }).innerText();
    assertIncludes(
      closeoutTargetText,
      "docs/qa/v2-manual-acceptance-export.json",
      "closeout target path"
    );
    assertIncludes(
      closeoutTargetText,
      "npm.cmd run qa:v2:closeout",
      "closeout target command"
    );
    recordPass(checks, "manual acceptance page shows closeout target path");

    const gateCount = await page.locator("[data-check]").count();
    assertEqual(gateCount, 19, "manual gate count");
    recordPass(checks, "manual gate count matched", { gateCount });

    await assertStatusIncludes(page, [
      "0/19 gates resolved.",
      "6 required run context fields missing.",
      "Required evidence notes complete.",
      "Manual pass is still blocked."
    ]);
    recordPass(checks, "blank run context blocks manual pass");

    writeManualSessionPage();
    await page.goto(pathToFileURL(SESSION_PAGE_PATH).href, {
      waitUntil: "domcontentloaded",
      timeout: 10000
    });
    await page.locator("#export-status").waitFor({ state: "visible", timeout: 10000 });
    await assertStatusIncludes(page, [
      "0/19 gates resolved.",
      "Required run context complete.",
      "Required evidence notes complete.",
      "Manual pass is still blocked."
    ]);
    const sessionCheckedGates = await page.locator("[data-check]:checked").count();
    assertEqual(sessionCheckedGates, 0, "embedded manual context checked gates");
    const sessionReport = await exportReport(page);
    assertEqual(sessionReport.manualPass, false, "manual pass after embedded context");
    assertEqual(sessionReport.fieldFailures.length, 0, "field failures after embedded context");
    assertEqual(
      sessionReport.blockingChecks.length,
      gateCount,
      "blocking gates after embedded context"
    );
    recordPass(checks, "embedded manual context prefills without resolving gates");
    artifacts.push("manual-acceptance-session.html");

    await applyManualContext(page);
    await assertStatusIncludes(page, [
      "0/19 gates resolved.",
      "Required run context complete.",
      "Required evidence notes complete.",
      "Manual pass is still blocked."
    ]);
    const importedCheckedGates = await page.locator("[data-check]:checked").count();
    assertEqual(importedCheckedGates, 0, "manual context import checked gates");
    const importedReport = await exportReport(page);
    assertEqual(importedReport.manualPass, false, "manual pass after context import");
    assertEqual(importedReport.fieldFailures.length, 0, "field failures after context import");
    assertEqual(
      importedReport.blockingChecks.length,
      gateCount,
      "blocking gates after context import"
    );
    recordPass(checks, "manual context import prefills without resolving gates");

    await setAllGates(page, true);
    await applyManualContext(page);
    const reappliedCheckedGates = await page.locator("[data-check]:checked").count();
    assertEqual(
      reappliedCheckedGates,
      gateCount,
      "same manual context import preserved checked gates"
    );
    recordPass(checks, "same manual context import preserves current gate decisions");

    await applyManualContext(page, {
      ...MANUAL_CONTEXT_FIXTURE,
      runId: "manual-page-smoke-context-next",
      fields: {
        ...REQUIRED_FIELD_FIXTURE,
        build: "manual-page-smoke-next"
      }
    });
    const resetCheckedGates = await page.locator("[data-check]:checked").count();
    assertEqual(resetCheckedGates, 0, "new manual context import reset checked gates");
    const resetReport = await exportReport(page);
    assertEqual(resetReport.manualPass, false, "manual pass after new context reset");
    assertEqual(resetReport.blockingChecks.length, gateCount, "blocking gates after new context reset");
    recordPass(checks, "new manual context import resets stale gate decisions");

    await page.locator("[data-action='clear']").click();
    await setAllGates(page, true);
    await assertStatusIncludes(page, [
      "19/19 gates resolved.",
      "6 required run context fields missing.",
      "6 required evidence notes missing.",
      "Manual pass is still blocked."
    ]);
    recordPass(checks, "all gates without run context blocks manual pass");

    await fillRequiredFields(page);
    await fillRequiredEvidenceNotes(page);
    await assertStatusIncludes(page, [
      "19/19 gates resolved.",
      "Required run context complete.",
      "Required evidence notes complete.",
      "Manual pass ready to export."
    ]);

    const passingReport = await exportReport(page);
    assertEqual(passingReport.manualPass, true, "manual pass after fields");
    assertEqual(passingReport.fieldFailures.length, 0, "field failures after fields");
    assertEqual(passingReport.evidenceFailures.length, 0, "evidence failures after notes");
    assertEqual(passingReport.blockingChecks.length, 0, "blocking gates after fields");
    recordPass(checks, "all gates with run context exports manual pass");

    await page.locator("[data-action='clear']").click();
    await fillRequiredFields(page);
    await fillRequiredEvidenceNotes(page);
    await setAllGates(page, true);
    await page.locator('[data-check="visual.pets"]').uncheck();
    await page.locator('[data-deferral="visual.pets"]').check();
    await page
      .locator('[data-deferral-note="visual.pets"]')
      .fill("Accepted as out of scope for page smoke.");
    await assertStatusIncludes(page, [
      "18/19 gates resolved.",
      "1 required run context field missing.",
      "Required evidence notes complete.",
      "Manual pass is still blocked."
    ]);

    const blockedDeferralReport = await exportReport(page);
    assertEqual(blockedDeferralReport.manualPass, false, "manual pass without deferral approver");
    assertIncludes(
      blockedDeferralReport.fieldFailures.join("\n"),
      "Accepted out of scope by",
      "deferral approver field failure"
    );
    recordPass(checks, "deferral without approver blocks manual pass");

    await page
      .locator('[data-field="acceptedOutOfScopeBy"]')
      .fill("V2 manual page smoke approver");
    await assertStatusIncludes(page, [
      "19/19 gates resolved.",
      "Required run context complete.",
      "Manual pass ready to export."
    ]);

    const deferredReport = await exportReport(page);
    assertEqual(deferredReport.manualPass, true, "manual pass with deferral approver");
    assertEqual(deferredReport.fieldFailures.length, 0, "deferral field failures");
    assertEqual(deferredReport.evidenceFailures.length, 0, "deferral evidence failures");
    assertEqual(deferredReport.blockingChecks.length, 0, "deferral blocking gates");
    recordPass(checks, "deferral with approver exports manual pass");

    await page.locator("[data-action='clear']").click();
    const runScreenshotPath = path.join(RUN_DIR, "manual-acceptance-page.png");
    await page.screenshot({ path: runScreenshotPath, fullPage: true });
    artifacts.push("manual-acceptance-page.png");
    if (UPDATE_SCREENSHOT) {
      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    }
    recordPass(checks, "manual acceptance screenshot captured", {
      screenshot: path.relative(ROOT_DIR, runScreenshotPath)
    });

    writeRunArtifacts({
      startedAt,
      checks,
      artifacts,
      screenshotUpdated: UPDATE_SCREENSHOT
    });

    console.log(
      JSON.stringify(
        {
          runId: RUN_ID,
          gateCount,
          manualPage: path.relative(ROOT_DIR, PAGE_PATH),
          screenshotUpdated: UPDATE_SCREENSHOT,
          screenshot: path.relative(ROOT_DIR, SCREENSHOT_PATH)
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

function recordPass(checks, name, details = {}) {
  checks.push({
    name,
    status: "pass",
    details
  });
}

function writeRunArtifacts({ startedAt, checks, artifacts, screenshotUpdated }) {
  const finishedAt = new Date().toISOString();
  const summary = {
    scenario: "manual-page",
    runId: RUN_ID,
    startedAt,
    confidenceLabel: "automated-pass",
    evidenceTier: "browser-smoke",
    checks,
    artifacts,
    finishedAt,
    exactClaimAllowed: "passed automated manual acceptance page export smoke for tested browser scope",
    uncoveredConditions: [
      "actual physical manual gate execution",
      "human subjective signoff",
      "browser state outside this local smoke run"
    ],
    screenshotUpdated
  };
  fs.writeFileSync(
    path.join(RUN_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );
  fs.writeFileSync(path.join(RUN_DIR, "report.md"), renderReport(summary));
}

function renderReport(summary) {
  const checks = summary.checks
    .map((check) => `- ${check.status.toUpperCase()}: ${check.name}`)
    .join("\n");
  const artifacts = summary.artifacts.length === 0
    ? "- None"
    : summary.artifacts.map((artifact) => `- ${artifact}`).join("\n");

  return `# Deskagotchi Manual Acceptance Page QA

Run ID: ${summary.runId}

Confidence: ${summary.confidenceLabel}

Evidence tier: ${summary.evidenceTier}

Exact claim allowed: ${summary.exactClaimAllowed}

## Checks

${checks}

## Artifacts

${artifacts}

## Uncovered Conditions

${summary.uncoveredConditions.map((condition) => `- ${condition}`).join("\n")}
`;
}

async function setAllGates(page, checked) {
  const gates = page.locator("[data-check]");
  const count = await gates.count();
  for (let index = 0; index < count; index += 1) {
    await gates.nth(index).setChecked(checked);
  }
}

async function fillRequiredFields(page) {
  for (const [fieldName, value] of Object.entries(REQUIRED_FIELD_FIXTURE)) {
    await page.locator(`[data-field="${fieldName}"]`).fill(value);
  }
}

async function fillRequiredEvidenceNotes(page) {
  for (const [fieldName, value] of Object.entries(REQUIRED_EVIDENCE_NOTE_FIXTURE)) {
    await page.locator(`[data-field="${fieldName}"]`).fill(value);
  }
}

async function applyManualContext(page, context = MANUAL_CONTEXT_FIXTURE) {
  await page
    .locator("[data-context-import]")
    .fill(JSON.stringify(context));
  await page.locator("[data-action='apply-context']").click();
}

function writeManualSessionPage() {
  const manualPage = fs.readFileSync(PAGE_PATH, "utf8");
  const placeholder =
    '<script id="deskagotchi-manual-context" type="application/json"></script>';
  if (!manualPage.includes(placeholder)) {
    throw new Error("Manual page is missing embedded context placeholder.");
  }
  const contextJson = JSON.stringify(MANUAL_CONTEXT_FIXTURE, null, 2).replace(
    /</g,
    "\\u003c"
  );
  fs.writeFileSync(
    SESSION_PAGE_PATH,
    manualPage.replace(
      placeholder,
      `<script id="deskagotchi-manual-context" type="application/json">\n${contextJson}\n</script>`
    ),
    "utf8"
  );
}

async function exportReport(page) {
  await page.locator("[data-action='export']").click();
  const payload = await page.locator("#export-output").inputValue();
  return JSON.parse(payload);
}

async function assertStatusIncludes(page, expectedSnippets) {
  const status = await page.locator("#export-status").innerText();
  for (const snippet of expectedSnippets) {
    assertIncludes(status, snippet, "manual page status");
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(value, expectedSnippet, label) {
  if (!value.includes(expectedSnippet)) {
    throw new Error(`${label}: missing '${expectedSnippet}' in '${value}'`);
  }
}

await main();
