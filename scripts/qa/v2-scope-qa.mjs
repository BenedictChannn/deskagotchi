import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createQaRun,
  finishQaRun,
  hasQaFailures,
  recordQaFail,
  recordQaPass
} from "./qa-run-utils.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_ROOT = path.join(ROOT_DIR, ".qa-runs");
const SCENARIO = "v2-scope";
const FORBIDDEN_HATCH_SURFACE_PATTERN =
  /\b(Hatch|hatch|CreateDraft|createDraft|GeneratePet|generatePet)\b/;
const FORBIDDEN_CUSTOM_PET_RELEASE_SURFACE_PATTERN =
  /\b(importPet|exportPet|ImportPet|ExportPet)\b/;

const SURFACE_FILES = [
  ["src/shared/ipc.ts", "IPC contract has no Hatch generation channel"],
  ["src/preload/index.ts", "preload bridge exposes no Hatch generation method"],
  ["src/main/index.ts", "main process registers no Hatch IPC handler"],
  ["src/renderer/src/App.tsx", "renderer router has no Hatch panel route"],
  ["src/renderer/src/components/PanelApp.tsx", "management panel has no Hatch tab"],
  ["src/renderer/src/components/OverlayApp.tsx", "overlay has no Hatch action"]
];

const CUSTOM_PET_RELEASE_SURFACE_FILES = [
  ["src/shared/ipc.ts", "IPC contract exposes no v0.1 custom pet import/export channel"],
  ["src/preload/index.ts", "preload bridge exposes no v0.1 custom pet import/export method"],
  ["src/main/index.ts", "main process registers no v0.1 custom pet import/export IPC handler"],
  ["src/renderer/src/components/PanelApp.tsx", "management panel exposes no v0.1 custom pet import/export action"]
];

const REQUIRED_DOC_SNIPPETS = [
  [
    "README.md",
    "Hatch/custom pet generation is deferred for V2 and custom pet import/export is not exposed in v0.1.",
    "README marks custom generation and custom import/export deferred for v0.1"
  ],
  [
    "README.md",
    "User-facing Hatch/custom pet generation and custom pet import/export are",
    "README archives user-facing Hatch and custom import/export for v0.1"
  ],
  [
    "docs/desktop-app.md",
    "Custom pet import/export is not exposed in v0.1.",
    "desktop app docs exclude custom pet import/export from v0.1"
  ],
  [
    "docs/qa/deskagotchi-v2-roadmap.html",
    "Custom pet generation is archived",
    "V2 roadmap archives custom pet generation"
  ],
  [
    "docs/v2-goal-success-criteria.md",
    "User-facing custom pet generation and custom pet import/export are not part of",
    "V2 success criteria exclude user-facing custom generation and import/export"
  ]
];

function main() {
  const run = createQaRun({
    rootDir: ROOT_DIR,
    qaRunsDir: QA_ROOT,
    scenario: SCENARIO,
    evidenceTier: "static-source"
  });

  for (const [relativePath, checkName] of SURFACE_FILES) {
    assertNoHatchSurface(run, relativePath, checkName);
  }

  for (const [relativePath, checkName] of CUSTOM_PET_RELEASE_SURFACE_FILES) {
    assertNoCustomPetReleaseSurface(run, relativePath, checkName);
  }

  for (const [relativePath, snippet, checkName] of REQUIRED_DOC_SNIPPETS) {
    assertSnippet(run, relativePath, snippet, checkName);
  }

  const result = finishQaRun(
    { rootDir: ROOT_DIR, qaRunsDir: QA_ROOT, run },
    {
      exactClaimAllowed:
        "passed static V2 scope QA: Hatch/custom generation and v0.1 custom pet import/export are not exposed through user-facing UI, route, preload, or IPC surfaces",
      uncoveredConditions: [
        "archived Hatch helper internals are not production custom generation",
        "internal package import/export helpers are not exposed through the v0.1 renderer bridge",
        "future user-facing custom generation or custom pet import/export requires a separate design and QA gate"
      ]
    }
  );
  console.log(JSON.stringify(result, null, 2));
  if (hasQaFailures(run)) {
    process.exit(1);
  }
}

function assertNoHatchSurface(run, relativePath, checkName) {
  const source = readProjectFile(relativePath);
  const match = FORBIDDEN_HATCH_SURFACE_PATTERN.exec(source);
  if (match === null) {
    recordQaPass(run, checkName, { path: relativePath });
    return;
  }
  recordQaFail(run, checkName, {
    path: relativePath,
    matched: match[0],
    index: match.index
  });
}

function assertNoCustomPetReleaseSurface(run, relativePath, checkName) {
  const source = readProjectFile(relativePath);
  const match = FORBIDDEN_CUSTOM_PET_RELEASE_SURFACE_PATTERN.exec(source);
  if (match === null) {
    recordQaPass(run, checkName, { path: relativePath });
    return;
  }
  recordQaFail(run, checkName, {
    path: relativePath,
    matched: match[0],
    index: match.index
  });
}

function assertSnippet(run, relativePath, snippet, checkName) {
  const source = readProjectFile(relativePath);
  if (source.includes(snippet)) {
    recordQaPass(run, checkName, { path: relativePath });
    return;
  }
  recordQaFail(run, checkName, {
    path: relativePath,
    expectedSnippet: snippet
  });
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

main();
