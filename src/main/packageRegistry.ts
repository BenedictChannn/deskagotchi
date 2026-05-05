import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  PetPackageSchema,
  type PetPackage,
  PetSource,
  type ValidationIssue,
  ValidationSeverity
} from "@shared/domain";
import {
  hasBlockingIssues,
  parsePetPackage,
  validatePetPackage
} from "@shared/packageValidation";

const MAX_PACKAGE_FILE_BYTES = 10 * 1024 * 1024;
const DISALLOWED_PACKAGE_EXTENSIONS = new Set([
  ".bat",
  ".cmd",
  ".com",
  ".exe",
  ".js",
  ".mjs",
  ".ps1",
  ".sh",
  ".vbs"
]);

export interface LoadedPetPackage {
  petPackage: PetPackage;
  packageRoot: string;
  issues: ValidationIssue[];
}

export interface RegistryLoadResult {
  packages: LoadedPetPackage[];
  issues: ValidationIssue[];
}

export async function loadPetPackagesFromDirectory(
  directory: string,
  expectedSource: PetSource
): Promise<RegistryLoadResult> {
  const packages: LoadedPetPackage[] = [];
  const issues: ValidationIssue[] = [];
  const entries = await safeReadDirectory(directory);

  for (const entry of entries) {
    const packageRoot = path.join(directory, entry);
    const entryStat = await stat(packageRoot);
    if (!entryStat.isDirectory()) {
      continue;
    }

    const packageResult = await loadPetPackage(packageRoot, expectedSource);
    if (packageResult.petPackage !== undefined) {
      packages.push({
        petPackage: packageResult.petPackage,
        packageRoot,
        issues: packageResult.issues
      });
    }
    issues.push(...packageResult.issues);
  }

  packages.sort((left, right) =>
    left.petPackage.name.localeCompare(right.petPackage.name)
  );

  return { packages, issues };
}

export async function loadPetPackage(
  packageRoot: string,
  expectedSource: PetSource
): Promise<{
  petPackage?: PetPackage;
  issues: ValidationIssue[];
}> {
  const manifestPath = path.join(packageRoot, "pet.json");
  const issues: ValidationIssue[] = [];

  try {
    const rawManifest = await readFile(manifestPath, "utf8");
    const parsedManifest = JSON.parse(rawManifest) as unknown;
    const parsedPackage = parsePetPackage(parsedManifest);
    issues.push(...parsedPackage.issues);

    if (parsedPackage.package === undefined) {
      return { issues };
    }

    if (parsedPackage.package.source !== expectedSource) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "unexpected_package_source",
        message: `Expected package source '${expectedSource}', received '${parsedPackage.package.source}'.`,
        path: "source"
      });
    }

    issues.push(
      ...(await validatePackageDirectory(packageRoot, parsedPackage.package))
    );

    if (hasBlockingIssues(issues)) {
      return { issues };
    }

    return {
      petPackage: parsedPackage.package,
      issues
    };
  } catch (error) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "manifest_unreadable",
      message:
        error instanceof Error
          ? `Could not read pet package manifest: ${error.message}`
          : "Could not read pet package manifest.",
      path: manifestPath
    });
    return { issues };
  }
}

export async function validatePackageDirectory(
  packageRoot: string,
  petPackage: PetPackage
): Promise<ValidationIssue[]> {
  const issues = validatePetPackage(petPackage);
  const entries = await listPackageFiles(packageRoot);

  for (const packageFile of entries) {
    const extension = path.extname(packageFile).toLowerCase();
    if (DISALLOWED_PACKAGE_EXTENSIONS.has(extension)) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "disallowed_package_file",
        message: `Pet packages cannot include executable file '${packageFile}'.`,
        path: packageFile
      });
    }
  }

  for (const assetPath of [
    petPackage.assets.spritesheet,
    petPackage.assets.preview,
    petPackage.assets.icon
  ]) {
    const resolvedAssetPath = resolvePackageAssetPath(packageRoot, assetPath);
    try {
      const assetStat = await stat(resolvedAssetPath);
      if (!assetStat.isFile()) {
        issues.push({
          severity: ValidationSeverity.Error,
          code: "asset_not_file",
          message: `Asset '${assetPath}' is not a file.`,
          path: assetPath
        });
      }
      if (assetStat.size > MAX_PACKAGE_FILE_BYTES) {
        issues.push({
          severity: ValidationSeverity.Error,
          code: "asset_too_large",
          message: `Asset '${assetPath}' exceeds the package safety limit.`,
          path: assetPath
        });
      }
    } catch (error) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "asset_missing",
        message:
          error instanceof Error
            ? `Asset '${assetPath}' is missing: ${error.message}`
            : `Asset '${assetPath}' is missing.`,
        path: assetPath
      });
    }
  }

  const packageParse = PetPackageSchema.safeParse(petPackage);
  if (!packageParse.success) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "schema_invalid_after_directory_validation",
      message: packageParse.error.message,
      path: "pet.json"
    });
  }

  return issues;
}

export function resolvePackageAssetPath(
  packageRoot: string,
  relativeAssetPath: string
): string {
  const root = path.resolve(packageRoot);
  const resolvedAssetPath = path.resolve(packageRoot, relativeAssetPath);
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (resolvedAssetPath !== root && !resolvedAssetPath.startsWith(rootWithSeparator)) {
    throw new Error(`Asset path escapes package root: ${relativeAssetPath}`);
  }

  return resolvedAssetPath;
}

async function listPackageFiles(packageRoot: string): Promise<string[]> {
  const results: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await safeReadDirectory(directory);
    for (const entry of entries) {
      const entryPath = path.join(directory, entry);
      const entryStat = await stat(entryPath);
      const relativeEntryPath = path.relative(packageRoot, entryPath);
      if (entryStat.isDirectory()) {
        await visit(entryPath);
      } else {
        results.push(relativeEntryPath);
      }
    }
  }

  await visit(packageRoot);
  return results;
}

async function safeReadDirectory(directory: string): Promise<string[]> {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
