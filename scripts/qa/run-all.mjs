import { spawnSync } from "node:child_process";
import process from "node:process";

const COMMANDS = [
  ["npm.cmd", ["run", "check"]],
  ["npm.cmd", ["run", "qa:desktop:launch"]],
  ["npm.cmd", ["run", "qa:desktop:drag"]],
  ["npm.cmd", ["run", "qa:desktop:overlay"]],
  ["npm.cmd", ["run", "qa:desktop:play"]],
  ["npm.cmd", ["run", "qa:desktop:lifecycle"]],
  ["npm.cmd", ["run", "qa:renderer"]],
  ["npm.cmd", ["run", "qa:assets:pets"]],
  ["npm.cmd", ["run", "qa:assets:items"]],
  ["npm.cmd", ["run", "qa:v2:scope"]],
  ["npm.cmd", ["run", "qa:v2:visual-page"]],
  ["npm.cmd", ["run", "qa:v2:manual-page"]]
];

for (const [command, args] of COMMANDS) {
  console.log(`\n[qa] ${command} ${args.join(" ")}`);
  const commandParts = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", command, ...args]]
    : [command, args];
  const child = spawnSync(commandParts[0], commandParts[1], {
    stdio: "inherit",
    env: {
      ...process.env,
      DESKAGOTCHI_QA_SKIP_BUILD:
        args.includes("check") || args.includes("qa:desktop:launch") ? "0" : "1"
    }
  });
  if (child.status !== 0) {
    process.exit(child.status ?? 1);
  }
}
