import process from "node:process";

import {
  packageManagerDisplayCommand,
  packageManagerScriptArgs,
  spawnPackageManager
} from "./package-manager.mjs";

const COMMANDS = [
  "qa:check",
  "qa:desktop:launch",
  "qa:desktop:drag",
  "qa:desktop:overlay",
  "qa:desktop:play",
  "qa:desktop:lifecycle",
  "qa:renderer",
  "qa:assets:pets",
  "qa:assets:items",
  "qa:v2:scope",
  "qa:v2:manual-context:smoke",
  "qa:v2:manual-preflight:smoke",
  "qa:v2:visual-page",
  "qa:v2:manual-page"
];

for (const scriptName of COMMANDS) {
  const args = packageManagerScriptArgs(scriptName);
  console.log(`\n[qa] ${packageManagerDisplayCommand(args)}`);
  const { child } = spawnPackageManager(args, {
    stdio: "inherit",
    env: {
      ...process.env,
      DESKAGOTCHI_QA_SKIP_BUILD:
        scriptName === "qa:check" || scriptName === "qa:desktop:launch" ? "0" : "1"
    }
  });
  if (child.status !== 0) {
    process.exit(child.status ?? 1);
  }
}
