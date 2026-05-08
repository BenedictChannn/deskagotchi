import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "../..");
const MODE = process.argv[2] ?? "pets";

function main() {
  if (MODE === "pets") {
    run("npm.cmd", ["run", "validate:pets"]);
    assertFile("docs/qa/deskdog-lcd-contact-sheet.png");
    console.log("Pet asset QA passed.");
    return;
  }

  if (MODE === "items") {
    assertFile("resources/items/lcd-core/items.json");
    assertFile("docs/qa/lcd-item-icons-contact-sheet.png");
    console.log("Item asset QA passed.");
    return;
  }

  throw new Error(`Unknown asset QA mode '${MODE}'.`);
}

function assertFile(relativePath) {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Expected QA artifact is missing: ${relativePath}`);
  }
}

function run(command, args) {
  const commandParts = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", command, ...args]]
    : [command, args];
  const child = spawnSync(commandParts[0], commandParts[1], {
    cwd: ROOT_DIR,
    stdio: "inherit"
  });
  if (child.status !== 0) {
    const error = child.error instanceof Error ? `: ${child.error.message}` : "";
    throw new Error(
      `${command} ${args.join(" ")} exited with ${child.status}${error}`
    );
  }
}

main();
