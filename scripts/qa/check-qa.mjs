import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createQaRun,
  finishQaRun,
  hasQaFailures,
  recordQaCheck
} from "./qa-run-utils.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const QA_RUNS_DIR = path.join(ROOT_DIR, ".qa-runs");

const STAGES = [
  {
    command: "npm.cmd",
    args: ["run", "lint"],
    checkName: "lint passed"
  },
  {
    command: "npm.cmd",
    args: ["run", "typecheck"],
    checkName: "typecheck passed"
  },
  {
    command: "npm.cmd",
    args: ["run", "test"],
    checkName: "test suite passed"
  }
];

function main() {
  const run = createQaRun({
    rootDir: ROOT_DIR,
    qaRunsDir: QA_RUNS_DIR,
    scenario: "check",
    evidenceTier: "static-code-quality"
  });
  for (const stage of STAGES) {
    runCommandCheck(run, stage);
  }
  const result = finishQaRun(
    { rootDir: ROOT_DIR, qaRunsDir: QA_RUNS_DIR, run },
    {
      exactClaimAllowed:
        "lint, TypeScript checking, and unit tests passed for this checkout",
      uncoveredConditions: [
        "manual desktop acceptance remains separate from static code-quality checks",
        "release packaging and installed-app behavior are covered by dedicated QA runs"
      ]
    }
  );
  console.log(JSON.stringify(result, null, 2));

  if (hasQaFailures(run)) {
    process.exit(1);
  }
}

function runCommandCheck(run, stage) {
  const commandParts = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", stage.command, ...stage.args]]
    : [stage.command, stage.args];
  const child = spawnSync(commandParts[0], commandParts[1], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: "pipe"
  });
  const command = `${stage.command} ${stage.args.join(" ")}`;
  const outputFileName = `${stage.checkName.replaceAll(" ", "-")}.log`;
  const outputPath = path.join(run.runDir, outputFileName);
  const output = [
    `$ ${command}`,
    "",
    "## stdout",
    child.stdout?.trim() ?? "",
    "",
    "## stderr",
    child.stderr?.trim() ?? ""
  ].join("\n");
  fs.writeFileSync(outputPath, output, "utf8");
  run.artifacts.push(outputFileName);
  recordQaCheck(run, stage.checkName, child.status === 0, {
    command,
    status: child.status,
    output: outputFileName
  });
}

main();
