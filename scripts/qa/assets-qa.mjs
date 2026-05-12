import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { readQaSourceState } from "./qa-git.mjs";
import {
  createQaRunId,
  recordQaEvidence,
  writeLatestRun
} from "./qa-run-utils.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = path.join(ROOT_DIR, ".qa-runs");
const MODE = process.argv[2] ?? "pets";

function main() {
  if (MODE !== "pets" && MODE !== "items") {
    throw new Error(`Unknown asset QA mode '${MODE}'.`);
  }

  const run = createRun(`assets-${MODE}`);
  if (MODE === "pets") {
    auditPets(run);
  } else {
    auditItems(run);
  }
  finishRun(run);

  if (run.checks.some((check) => check.status === "fail")) {
    process.exit(1);
  }
}

function createRun(scenario) {
  const runId = createQaRunId(scenario);
  const runDir = path.join(QA_RUNS_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });
  writeLatestRun(QA_RUNS_DIR, runDir);
  return {
    scenario,
    runId,
    runDir,
    startedAt: new Date().toISOString(),
    sourceState: readQaSourceState(ROOT_DIR),
    confidenceLabel: "failed",
    evidenceTier: "static-assets",
    checks: [],
    artifacts: []
  };
}

function auditPets(run) {
  runCommandCheck(
    run,
    "built-in pet package registry validation passed",
    "npm.cmd",
    ["run", "validate:pets"]
  );
  for (const petId of loadBuiltInPetIds()) {
    checkFile(run, `resources/pets/${petId}/pet.json`, `${petId} manifest exists`);
    checkFile(run, `resources/pets/${petId}/spritesheet.png`, `${petId} spritesheet exists`);
    checkFile(run, `resources/pets/${petId}/preview.png`, `${petId} preview exists`);
    checkFile(run, `resources/pets/${petId}/icon.png`, `${petId} icon exists`);
    checkFile(run, `docs/qa/${petId}-contact-sheet.png`, `${petId} contact sheet exists`);
  }
  checkFile(run, "docs/qa/v2-visual-acceptance.html", "V2 visual acceptance page exists");
  checkBuiltInPetTheme(run);
}

function loadBuiltInPetIds() {
  const rosterPath = path.join(ROOT_DIR, "resources", "pets", "built-in-roster.json");
  const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
  return Array.isArray(roster.petIds) ? roster.petIds : [];
}

function auditItems(run) {
  const manifest = checkJsonFile(
    run,
    "resources/items/lcd-core/items.json",
    "item manifest exists and parses"
  );
  checkFile(run, "docs/qa/lcd-item-icons-contact-sheet.png", "full item icon contact sheet exists");
  checkFile(run, "docs/qa/lcd-food-icons-contact-sheet.png", "food icon contact sheet exists");
  if (manifest !== null) {
    checkItemManifest(run, manifest);
  }
}

function checkFile(run, relativePath, checkName) {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  if (fs.existsSync(absolutePath)) {
    recordPass(run, checkName, { path: relativePath });
    run.artifacts.push(relativePath);
    return true;
  }
  recordFail(run, checkName, { path: relativePath });
  return false;
}

function checkJsonFile(run, relativePath, checkName) {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    recordPass(run, checkName, { path: relativePath });
    run.artifacts.push(relativePath);
    return parsed;
  } catch (error) {
    recordFail(run, checkName, {
      path: relativePath,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

function checkBuiltInPetTheme(run) {
  const petsRoot = path.join(ROOT_DIR, "resources", "pets");
  const packageDirs = loadBuiltInPetIds().map((petId) => path.join(petsRoot, petId));
  const themeFailures = [];
  const paletteFailures = [];

  for (const packageDir of packageDirs) {
    const manifestPath = path.join(packageDir, "pet.json");
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.source !== "built-in") {
      continue;
    }
    if (!Array.isArray(manifest.capabilities) || !manifest.capabilities.includes("retro-lcd")) {
      themeFailures.push(manifest.packageId);
    }
    if (!Array.isArray(manifest.colorPalette) || manifest.colorPalette.length > 4) {
      paletteFailures.push(manifest.packageId);
    }
  }

  recordCheck(
    run,
    "built-in pet manifests use retro-LCD capability",
    themeFailures.length === 0,
    { failures: themeFailures }
  );
  recordCheck(
    run,
    "built-in pet palettes use at most four colors",
    paletteFailures.length === 0,
    { failures: paletteFailures }
  );
}

function checkItemManifest(run, manifest) {
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const foodItems = icons.filter((item) => item.category === "meal" || item.category === "snack");
  const atlas = typeof manifest.atlas === "string" ? manifest.atlas : "";

  recordCheck(run, "item manifest includes food items", foodItems.length > 0, {
    foodItemCount: foodItems.length
  });
  recordCheck(run, "item atlas referenced by manifest exists", atlas.length > 0 &&
    fs.existsSync(path.join(ROOT_DIR, "resources", "items", "lcd-core", atlas)), {
    atlas
  });
}

function runCommandCheck(run, checkName, command, args) {
  const commandParts = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", command, ...args]]
    : [command, args];
  const child = spawnSync(commandParts[0], commandParts[1], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: "pipe"
  });
  const details = {
    command: `${command} ${args.join(" ")}`,
    status: child.status,
    stdout: child.stdout?.trim() ?? "",
    stderr: child.stderr?.trim() ?? ""
  };
  recordCheck(run, checkName, child.status === 0, details);
}

function recordCheck(run, name, passed, details = {}) {
  if (passed) {
    recordPass(run, name, details);
    return;
  }
  recordFail(run, name, details);
}

function recordPass(run, name, details = {}) {
  run.checks.push({ name, status: "pass", details });
}

function recordFail(run, name, details = {}) {
  run.checks.push({ name, status: "fail", details });
}

function finishRun(run) {
  run.finishedAt = new Date().toISOString();
  run.confidenceLabel = run.checks.some((check) => check.status === "fail")
    ? "failed"
    : "automated-pass";
  run.exactClaimAllowed = run.confidenceLabel === "automated-pass"
    ? `passed ${run.scenario} static asset QA`
    : "No fixed claim allowed.";
  run.uncoveredConditions = [
    "subjective visual appeal still requires manual V2 acceptance",
    "runtime animation feel is covered by desktop and visual-page QA"
  ];
  run.artifacts.push("summary.json", "report.md");
  fs.writeFileSync(path.join(run.runDir, "summary.json"), JSON.stringify(run, null, 2));
  fs.writeFileSync(path.join(run.runDir, "report.md"), renderReport(run), "utf8");
  recordQaEvidence(QA_RUNS_DIR, run.scenario, run.runDir);
  console.log(
    JSON.stringify(
      {
        runId: run.runId,
        checks: run.checks.length,
        confidenceLabel: run.confidenceLabel,
        report: path.relative(ROOT_DIR, path.join(run.runDir, "report.md"))
      },
      null,
      2
    )
  );
}

function renderReport(run) {
  const checks = run.checks
    .map((check) => `- ${check.status.toUpperCase()}: ${check.name}`)
    .join("\n");
  const artifacts = Array.from(new Set(run.artifacts))
    .map((artifact) => `- ${artifact}`)
    .join("\n");
  return `# Deskagotchi Asset QA

Scenario: ${run.scenario}

Run id: ${run.runId}

Confidence: ${run.confidenceLabel}

Evidence tier: ${run.evidenceTier}

## Checks

${checks}

## Artifacts

${artifacts}

## Exact Claim Allowed

${run.exactClaimAllowed}

## Uncovered Conditions

${run.uncoveredConditions.map((condition) => `- ${condition}`).join("\n")}
`;
}

main();
