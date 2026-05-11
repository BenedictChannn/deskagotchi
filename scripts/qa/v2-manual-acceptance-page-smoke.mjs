import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const PAGE_PATH = path.join(ROOT_DIR, "docs", "qa", "v2-manual-acceptance.html");
const SCREENSHOT_PATH = path.join(
  ROOT_DIR,
  "docs",
  "qa",
  "v2-manual-acceptance-screenshot.png"
);
const UPDATE_SCREENSHOT = process.argv.includes("--update-screenshot");
const REQUIRED_FIELD_FIXTURE = {
  tester: "V2 manual page smoke",
  date: "2026-05-11",
  windowsVersion: "Windows smoke fixture",
  build: "manual-page-smoke",
  monitorSetup: "single-display smoke fixture"
};

async function main() {
  const browser = await launchBrowser();
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

    const gateCount = await page.locator("[data-check]").count();
    assertEqual(gateCount, 19, "manual gate count");

    await assertStatusIncludes(page, [
      "0/19 gates resolved.",
      "5 required run context fields missing.",
      "Manual pass is still blocked."
    ]);

    await setAllGates(page, true);
    await assertStatusIncludes(page, [
      "19/19 gates resolved.",
      "5 required run context fields missing.",
      "Manual pass is still blocked."
    ]);

    await fillRequiredFields(page);
    await assertStatusIncludes(page, [
      "19/19 gates resolved.",
      "Required run context complete.",
      "Manual pass ready to export."
    ]);

    const passingReport = await exportReport(page);
    assertEqual(passingReport.manualPass, true, "manual pass after fields");
    assertEqual(passingReport.fieldFailures.length, 0, "field failures after fields");
    assertEqual(passingReport.blockingChecks.length, 0, "blocking gates after fields");

    await page.locator("[data-action='clear']").click();
    await fillRequiredFields(page);
    await setAllGates(page, true);
    await page.locator('[data-check="visual.pets"]').uncheck();
    await page.locator('[data-deferral="visual.pets"]').check();
    await page
      .locator('[data-deferral-note="visual.pets"]')
      .fill("Accepted as out of scope for page smoke.");
    await assertStatusIncludes(page, [
      "18/19 gates resolved.",
      "1 required run context field missing.",
      "Manual pass is still blocked."
    ]);

    const blockedDeferralReport = await exportReport(page);
    assertEqual(blockedDeferralReport.manualPass, false, "manual pass without deferral approver");
    assertIncludes(
      blockedDeferralReport.fieldFailures.join("\n"),
      "Accepted out of scope by",
      "deferral approver field failure"
    );

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
    assertEqual(deferredReport.blockingChecks.length, 0, "deferral blocking gates");

    if (UPDATE_SCREENSHOT) {
      await page.locator("[data-action='clear']").click();
      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    }

    console.log(
      JSON.stringify(
        {
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

async function launchBrowser() {
  const executablePath = findBrowserExecutable();
  try {
    return await chromium.launch({
      executablePath,
      headless: true
    });
  } catch (error) {
    if (executablePath !== undefined) {
      throw error;
    }
    throw new Error(
      "Could not launch Playwright Chromium. Install Playwright browsers or Chrome/Edge for manual acceptance page smoke.",
      { cause: error }
    );
  }
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter((candidate) => candidate !== undefined);

  return candidates.find((candidate) => fs.existsSync(candidate));
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
