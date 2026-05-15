import { spawnSync } from "node:child_process";
import process from "node:process";

const PACKAGE_MANAGER = "pnpm";

export function packageManagerDisplayCommand(args) {
  return `${PACKAGE_MANAGER} ${args.join(" ")}`;
}

export function packageManagerScriptArgs(scriptName) {
  return ["run", scriptName];
}

export function spawnPackageManager(args, options = {}) {
  const fullArgs = [PACKAGE_MANAGER, ...args];
  const commandParts =
    process.platform === "win32"
      ? ["cmd.exe", ["/d", "/s", "/c", ...fullArgs]]
      : [PACKAGE_MANAGER, args];

  return {
    child: spawnSync(commandParts[0], commandParts[1], options),
    displayCommand: packageManagerDisplayCommand(args)
  };
}
