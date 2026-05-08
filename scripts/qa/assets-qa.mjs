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
    assertFile("docs/qa/bao-contact-sheet.png");
    assertFile("docs/qa/deskdog-lcd-contact-sheet.png");
    assertFile("docs/qa/miso-contact-sheet.png");
    assertFile("docs/qa/mochi-contact-sheet.png");
    assertFile("docs/qa/peanut-contact-sheet.png");
    assertBuiltInPetTheme();
    console.log("Pet asset QA passed.");
    return;
  }

  if (MODE === "items") {
    assertFile("resources/items/lcd-core/items.json");
    assertFile("docs/qa/lcd-item-icons-contact-sheet.png");
    assertFile("docs/qa/lcd-food-icons-contact-sheet.png");
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

function assertBuiltInPetTheme() {
  const petsRoot = path.join(ROOT_DIR, "resources", "pets");
  const packageDirs = fs
    .readdirSync(petsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(petsRoot, entry.name));

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
      throw new Error(
        `Built-in pet is missing retro-LCD capability: ${manifest.packageId}`
      );
    }
    if (!Array.isArray(manifest.colorPalette) || manifest.colorPalette.length > 4) {
      throw new Error(
        `Built-in pet must keep a 1-4 color palette: ${manifest.packageId}`
      );
    }
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
