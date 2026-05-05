import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { PetSource } from "@shared/domain";
import { createTestPetPackage } from "@shared/fixtures";

import {
  loadPetPackagesFromDirectory,
  resolvePackageAssetPath
} from "./packageRegistry";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"></svg>`;

describe("package registry", () => {
  it("loads the committed built-in pet resources", async () => {
    const resourcesRoot = path.resolve(process.cwd(), "resources", "pets");
    const result = await loadPetPackagesFromDirectory(
      resourcesRoot,
      PetSource.BuiltIn
    );

    expect(result.packages.length).toBeGreaterThanOrEqual(4);
    expect(result.issues).toEqual([]);
  });

  it("loads a valid package directory", async () => {
    const tempDir = await mkdtempPackage("valid");
    const packageRoot = path.join(tempDir, "deskcat");
    await writePackage(packageRoot, createTestPetPackage());

    const result = await loadPetPackagesFromDirectory(tempDir, PetSource.BuiltIn);

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.petPackage.packageId).toBe("deskcat");
  });

  it("rejects packages with disallowed executable files", async () => {
    const tempDir = await mkdtempPackage("unsafe");
    const packageRoot = path.join(tempDir, "deskcat");
    await writePackage(packageRoot, createTestPetPackage());
    await writeFile(path.join(packageRoot, "install.ps1"), "Write-Host nope", "utf8");

    const result = await loadPetPackagesFromDirectory(tempDir, PetSource.BuiltIn);

    expect(result.packages).toHaveLength(0);
    expect(
      result.issues.some((issue) => issue.code === "disallowed_package_file")
    ).toBe(true);
  });

  it("prevents asset path traversal", () => {
    expect(() => resolvePackageAssetPath("C:/safe/root", "../escape.svg")).toThrow(
      "escapes package root"
    );
  });
});

async function mkdtempPackage(name: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), `deskagotchi-${name}-`));
}

async function writePackage(packageRoot: string, petPackage: unknown): Promise<void> {
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, "pet.json"),
    `${JSON.stringify(petPackage, null, 2)}\n`,
    "utf8"
  );
  await writeFile(path.join(packageRoot, "spritesheet.svg"), SVG, "utf8");
  await writeFile(path.join(packageRoot, "preview.svg"), SVG, "utf8");
  await writeFile(path.join(packageRoot, "icon.svg"), SVG, "utf8");
}
