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

const SURFACE_FILES = [
  ["src/shared/ipc.ts", "IPC contract has no Hatch generation channel"],
  ["src/preload/index.ts", "preload bridge exposes no Hatch generation method"],
  ["src/main/index.ts", "main process registers no Hatch IPC handler"],
  ["src/renderer/src/App.tsx", "renderer router has no Hatch panel route"],
  ["src/renderer/src/components/PanelApp.tsx", "management panel has no Hatch tab"],
  ["src/renderer/src/components/OverlayApp.tsx", "overlay has no Hatch action"]
];

const REQUIRED_DOC_SNIPPETS = [
  [
    "README.md",
    "Hatch/custom pet generation is deferred for V2",
    "README marks Hatch/custom generation deferred for V2"
  ],
  [
    "README.md",
    "User-facing Hatch/custom pet generation is archived for the V2 release path.",
    "README archives user-facing Hatch for the V2 release path"
  ],
  [
    "docs/qa/deskagotchi-v2-roadmap.html",
    "Custom pet generation is archived",
    "V2 roadmap archives custom pet generation"
  ],
  [
    "docs/v2-goal-success-criteria.md",
    "User-facing custom pet generation is not part of the V2 promise.",
    "V2 success criteria exclude user-facing custom generation"
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

  for (const [relativePath, snippet, checkName] of REQUIRED_DOC_SNIPPETS) {
    assertSnippet(run, relativePath, snippet, checkName);
  }

  const result = finishQaRun(
    { rootDir: ROOT_DIR, qaRunsDir: QA_ROOT, run },
    {
      exactClaimAllowed:
        "passed static V2 scope QA: Hatch/custom generation is not exposed through user-facing UI, route, preload, or IPC surfaces",
      uncoveredConditions: [
        "archived Hatch helper internals are not production custom generation",
        "future user-facing custom generation requires a separate design and QA gate"
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
