/**
 * Shared package validation helpers for manifests and runtime imports.
 *
 * @module
 */
import {
  AnimationId,
  PackageValidationStatus,
  type PetPackage,
  PetPackageSchema,
  type ValidationIssue,
  ValidationSeverity
} from "./domain";

/** Minimum animation set required for an MVP-compatible pet package. */
export const REQUIRED_MVP_ANIMATIONS = [
  AnimationId.Idle,
  AnimationId.Happy,
  AnimationId.Sleeping,
  AnimationId.Sick
];

const ALLOWED_ASSET_EXTENSIONS = [".png", ".webp", ".svg"];

/**
 * Parses unknown package data and converts schema errors into validation issues.
 *
 * @param input Raw manifest data from disk, import, or authoring tools.
 * @returns Parsed package when valid, plus validation issues for display/logging.
 */
export function parsePetPackage(input: unknown): {
  package?: PetPackage;
  issues: ValidationIssue[];
} {
  const parsed = PetPackageSchema.safeParse(input);

  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => ({
        severity: ValidationSeverity.Error,
        code: "schema_invalid",
        message: issue.message,
        path: issue.path.join(".")
      }))
    };
  }

  const issues = validatePetPackage(parsed.data);
  return {
    package: parsed.data,
    issues
  };
}

/**
 * Runs semantic package checks that require a schema-valid pet manifest.
 *
 * @param petPackage Parsed pet package manifest.
 * @returns Validation issues for missing animations, asset formats, and growth links.
 */
export function validatePetPackage(petPackage: PetPackage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const animationIds = new Set<AnimationId>();

  for (const animation of petPackage.animations) {
    if (animationIds.has(animation.id)) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "duplicate_animation",
        message: `Animation '${animation.id}' is declared more than once.`,
        path: `animations.${animation.id}`
      });
    }
    animationIds.add(animation.id);
  }

  for (const requiredAnimation of REQUIRED_MVP_ANIMATIONS) {
    if (!animationIds.has(requiredAnimation)) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "missing_required_animation",
        message: `MVP packages must define '${requiredAnimation}'.`,
        path: "animations"
      });
    }
  }

  for (const animation of petPackage.animations) {
    if (animation.fallback !== undefined && !animationIds.has(animation.fallback)) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "missing_animation_fallback",
        message: `Animation '${animation.id}' falls back to missing '${animation.fallback}'.`,
        path: `animations.${animation.id}.fallback`
      });
    }
  }

  const maxRow = petPackage.animations.reduce(
    (largestRow, animation) => Math.max(largestRow, animation.row),
    0
  );
  if (maxRow > 32) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "spritesheet_too_tall",
      message: "Spritesheet row count exceeds the MVP safety limit.",
      path: "animations"
    });
  }

  for (const assetPath of [
    petPackage.assets.spritesheet,
    petPackage.assets.preview,
    petPackage.assets.icon
  ]) {
    const normalizedPath = assetPath.replaceAll("\\", "/");
    const extension = normalizedPath.slice(normalizedPath.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_ASSET_EXTENSIONS.includes(extension)) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "unsupported_asset_format",
        message: `Asset '${assetPath}' must be PNG, WebP, or SVG for the MVP runtime.`,
        path: assetPath
      });
    }
  }

  for (const growthStage of petPackage.growthStages) {
    for (const animationId of growthStage.animationSet) {
      if (!animationIds.has(animationId)) {
        issues.push({
          severity: ValidationSeverity.Error,
          code: "growth_stage_missing_animation",
          message: `Growth stage '${growthStage.id}' references missing animation '${animationId}'.`,
          path: `growthStages.${growthStage.id}.animationSet`
        });
      }
    }
    if (growthStage.careScoreMin > growthStage.careScoreMax) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "invalid_care_range",
        message: `Growth stage '${growthStage.id}' has an inverted care score range.`,
        path: `growthStages.${growthStage.id}`
      });
    }
  }

  if (
    petPackage.validationStatus === PackageValidationStatus.Passed &&
    issues.some((issue) => issue.severity === ValidationSeverity.Error)
  ) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "passed_package_has_errors",
      message: "Package is marked as passed but still has validation errors.",
      path: "validationStatus"
    });
  }

  return issues;
}

/**
 * Indicates whether a package issue list contains any blocking errors.
 *
 * @param issues Issues returned by package parsing or semantic validation.
 * @returns True when at least one issue has error severity.
 */
export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === ValidationSeverity.Error);
}
