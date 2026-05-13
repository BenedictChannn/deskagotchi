import { spawnSync } from "node:child_process";
import process from "node:process";

const COREPACK_COMMAND = "corepack";
const PACKAGE_MANAGER = "pnpm";

export function packageManagerDisplayCommand(args) {
  return `${COREPACK_COMMAND} ${PACKAGE_MANAGER} ${args.join(" ")}`;
}

export function packageManagerScriptArgs(scriptName) {
  return ["run", scriptName];
}

export function spawnPackageManager(args, options = {}) {
  const fullArgs = [PACKAGE_MANAGER, ...args];
  const commandParts =
    process.platform === "win32"
      ? ["cmd.exe", ["/d", "/s", "/c", COREPACK_COMMAND, ...fullArgs]]
      : [COREPACK_COMMAND, fullArgs];

  return {
    child: spawnSync(commandParts[0], commandParts[1], options),
    displayCommand: packageManagerDisplayCommand(args)
  };
}
