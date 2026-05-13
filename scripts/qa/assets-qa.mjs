import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createQaRun,
  finishQaRun,
  hasQaFailures,
  recordQaCheck,
  recordQaFail,
  recordQaPass
} from "./qa-run-utils.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = path.join(ROOT_DIR, ".qa-runs");
const MODE = process.argv[2] ?? "pets";

function main() {
  if (MODE !== "pets" && MODE !== "items") {
    throw new Error(`Unknown asset QA mode '${MODE}'.`);
  }

  const run = createQaRun({
    rootDir: ROOT_DIR,
    qaRunsDir: QA_RUNS_DIR,
    scenario: `assets-${MODE}`,
    evidenceTier: "static-assets"
  });
  if (MODE === "pets") {
    auditPets(run);
  } else {
    auditItems(run);
  }
  const result = finishQaRun(
    { rootDir: ROOT_DIR, qaRunsDir: QA_RUNS_DIR, run },
    {
      exactClaimAllowed: `passed ${run.scenario} static asset QA`,
      uncoveredConditions: [
        "subjective visual appeal still requires manual V2 acceptance",
        "runtime animation feel is covered by desktop and visual-page QA"
      ]
    }
  );
  console.log(JSON.stringify(result, null, 2));

  if (hasQaFailures(run)) {
    process.exit(1);
  }
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
    recordQaPass(run, checkName, { path: relativePath });
    run.artifacts.push(relativePath);
    return true;
  }
  recordQaFail(run, checkName, { path: relativePath });
  return false;
}

function checkJsonFile(run, relativePath, checkName) {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    recordQaPass(run, checkName, { path: relativePath });
    run.artifacts.push(relativePath);
    return parsed;
  } catch (error) {
    recordQaFail(run, checkName, {
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

  recordQaCheck(
    run,
    "built-in pet manifests use retro-LCD capability",
    themeFailures.length === 0,
    { failures: themeFailures }
  );
  recordQaCheck(
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

  recordQaCheck(run, "item manifest includes food items", foodItems.length > 0, {
    foodItemCount: foodItems.length
  });
  recordQaCheck(run, "item atlas referenced by manifest exists", atlas.length > 0 &&
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
  recordQaCheck(run, checkName, child.status === 0, details);
}

main();
