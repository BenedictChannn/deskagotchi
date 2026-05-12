import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { launchQaBrowser } from "./browser-smoke-utils.mjs";
import { readQaSourceState } from "./qa-git.mjs";
import {
  createQaRunId,
  recordQaEvidence,
  writeLatestRun
} from "./qa-run-utils.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = path.join(ROOT_DIR, ".qa-runs");
const PETS_ROOT = path.join(ROOT_DIR, "resources", "pets");
const VISUAL_PAGE_PATH = path.join(ROOT_DIR, "docs", "qa", "v2-visual-acceptance.html");
const GALLERY_PAGE_PATH = path.join(ROOT_DIR, "docs", "qa", "pet-animation-gallery.html");
const SCREENSHOT_PATH = path.join(
  ROOT_DIR,
  "docs",
  "qa",
  "v2-visual-acceptance-screenshot.png"
);
const RUN_ID = createQaRunId("visual-page");
const RUN_DIR = path.join(QA_RUNS_DIR, RUN_ID);
const UPDATE_SCREENSHOT = process.argv.includes("--update-screenshot");
const EXPECTED_ANIMATION_COUNT = 11;

async function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  writeLatestRun(QA_RUNS_DIR, RUN_DIR);
  const startedAt = new Date().toISOString();
  const checks = [];
  const artifacts = [];
  const pets = loadBuiltInPets();
  const browser = await launchQaBrowser("V2 visual page smoke");
  const context = await browser.newContext({
    viewport: { width: 1360, height: 1800 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  try {
    await smokeVisualAcceptancePage(page, checks, artifacts, pets);
    await smokeAnimationGallery(page, checks, artifacts, pets);
  } finally {
    await browser.close();
  }

  writeRunArtifacts({ startedAt, checks, artifacts });
  if (checks.some((check) => check.status === "fail")) {
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        runId: RUN_ID,
        pets: pets.length,
        checks: checks.length,
        screenshotUpdated: UPDATE_SCREENSHOT,
        report: path.relative(ROOT_DIR, path.join(RUN_DIR, "report.md"))
      },
      null,
      2
    )
  );
}

function loadBuiltInPets() {
  return loadBuiltInPetIds()
    .map((petId) => {
      const manifestPath = path.join(PETS_ROOT, petId, "pet.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      return {
        id: petId,
        name: manifest.name,
        source: manifest.source,
        animationCount: manifest.animations.length
      };
    })
    .filter((pet) => pet.source === "built-in")
    .sort((left, right) => left.name.localeCompare(right.name));
}

function loadBuiltInPetIds() {
  const rosterPath = path.join(PETS_ROOT, "built-in-roster.json");
  const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
  return Array.isArray(roster.petIds) ? roster.petIds : [];
}

async function smokeVisualAcceptancePage(page, checks, artifacts, pets) {
  await page.goto(pathToFileURL(VISUAL_PAGE_PATH).href, {
    waitUntil: "networkidle",
    timeout: 10_000
  });
  recordPass(checks, "visual acceptance page loaded");

  const petCardCount = await page.locator(".pet-card").count();
  assertEqual(checks, "visual acceptance page has every built-in pet card", petCardCount, pets.length);

  const foodReviewCount = await page.locator(".food-review").count();
  assertEqual(checks, "visual acceptance page has food and item review sheets", foodReviewCount, 2);

  const criteriaCount = await page.locator(".acceptance-grid input[type='checkbox']").count();
  assertEqual(checks, "visual acceptance page has six review criteria", criteriaCount, 6);

  const headings = await page.locator(".pet-card h3").allInnerTexts();
  assertArrayEqual(
    checks,
    "visual acceptance page pet names match built-in roster",
    headings.sort(),
    pets.map((pet) => pet.name).sort()
  );

  await assertNoBrokenImages(page, checks, "visual acceptance page images load");

  const runScreenshotPath = path.join(RUN_DIR, "visual-acceptance-page.png");
  await page.screenshot({ path: runScreenshotPath, fullPage: true });
  artifacts.push("visual-acceptance-page.png");
  if (UPDATE_SCREENSHOT) {
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  }
  recordPass(checks, "visual acceptance screenshot captured", {
    screenshot: path.relative(ROOT_DIR, runScreenshotPath),
    screenshotUpdated: UPDATE_SCREENSHOT
  });
}

async function smokeAnimationGallery(page, checks, artifacts, pets) {
  await page.goto(pathToFileURL(GALLERY_PAGE_PATH).href, {
    waitUntil: "networkidle",
    timeout: 10_000
  });
  await page.locator("#pet-list .pet-card").first().waitFor({ timeout: 10_000 });
  recordPass(checks, "pet animation gallery loaded");

  const petCardCount = await page.locator("#pet-list .pet-card").count();
  assertEqual(checks, "pet animation gallery has every built-in pet card", petCardCount, pets.length);

  const animationCellCount = await page.locator(".animation-cell").count();
  assertEqual(
    checks,
    "pet animation gallery has every core animation row",
    animationCellCount,
    pets.length * EXPECTED_ANIMATION_COUNT
  );

  const headings = await page.locator("#pet-list h2").allInnerTexts();
  assertArrayEqual(
    checks,
    "pet animation gallery pet names match built-in roster",
    headings.sort(),
    pets.map((pet) => pet.name).sort()
  );

  const backgroundCount = await page
    .locator(".sprite")
    .evaluateAll((sprites) =>
      sprites.filter((sprite) => {
        const view = sprite.ownerDocument.defaultView;
        return view?.getComputedStyle(sprite).backgroundImage.includes("spritesheet.png");
      }).length
    );
  assertEqual(
    checks,
    "pet animation gallery sprites reference committed spritesheets",
    backgroundCount,
    pets.length * EXPECTED_ANIMATION_COUNT
  );

  await page.locator("[data-action='pause']").click();
  await assertBodyClass(page, checks, "pet animation gallery pause control works", "paused", true);
  await page.locator("[data-action='play']").click();
  await assertBodyClass(page, checks, "pet animation gallery play control works", "paused", false);
  await assertNoBrokenImages(page, checks, "pet animation gallery preview images load");

  const runScreenshotPath = path.join(RUN_DIR, "pet-animation-gallery.png");
  await page.screenshot({ path: runScreenshotPath, fullPage: true });
  artifacts.push("pet-animation-gallery.png");
  recordPass(checks, "pet animation gallery screenshot captured", {
    screenshot: path.relative(ROOT_DIR, runScreenshotPath)
  });
}

async function assertNoBrokenImages(page, checks, checkName) {
  const brokenImages = await page.locator("img").evaluateAll((images) =>
    images
      .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
      .map((image) => ({
        src: image.getAttribute("src"),
        alt: image.getAttribute("alt")
      }))
  );
  if (brokenImages.length === 0) {
    recordPass(checks, checkName);
    return;
  }
  recordFail(checks, checkName, { brokenImages });
}

async function assertBodyClass(page, checks, checkName, className, expected) {
  const hasClass = await page.locator("body").evaluate((body, targetClassName) =>
    body.classList.contains(targetClassName),
    className
  );
  assertEqual(checks, checkName, hasClass, expected);
}

function assertEqual(checks, checkName, actual, expected) {
  if (actual === expected) {
    recordPass(checks, checkName, { actual });
    return;
  }
  recordFail(checks, checkName, { actual, expected });
}

function assertArrayEqual(checks, checkName, actual, expected) {
  if (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  ) {
    recordPass(checks, checkName, { actual });
    return;
  }
  recordFail(checks, checkName, { actual, expected });
}

function recordPass(checks, name, details = {}) {
  checks.push({ name, status: "pass", details });
}

function recordFail(checks, name, details = {}) {
  checks.push({ name, status: "fail", details });
}

function writeRunArtifacts({ startedAt, checks, artifacts }) {
  const finishedAt = new Date().toISOString();
  const summary = {
    scenario: "visual-page",
    runId: RUN_ID,
    startedAt,
    sourceState: readQaSourceState(ROOT_DIR),
    confidenceLabel: checks.some((check) => check.status === "fail")
      ? "failed"
      : "automated-pass",
    evidenceTier: "browser-smoke",
    checks,
    artifacts,
    finishedAt,
    exactClaimAllowed:
      "passed automated visual page smoke for tested browser scope; subjective pet and food recognizability still requires manual acceptance",
    uncoveredConditions: [
      "human subjective visual acceptance",
      "actual desktop overlay scale perception",
      "visual quality beyond structural page and image-load checks"
    ],
    screenshotUpdated: UPDATE_SCREENSHOT
  };
  const summaryPath = path.join(RUN_DIR, "summary.json");
  const reportPath = path.join(RUN_DIR, "report.md");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(reportPath, renderReport(summary));
  recordQaEvidence(QA_RUNS_DIR, summary.scenario, RUN_DIR);
}

function renderReport(summary) {
  const checks = summary.checks
    .map((check) => `- ${check.status.toUpperCase()}: ${check.name}`)
    .join("\n");
  const artifacts = summary.artifacts.length === 0
    ? "- None"
    : summary.artifacts.map((artifact) => `- ${artifact}`).join("\n");

  return `# Deskagotchi V2 Visual Page QA

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

main();
