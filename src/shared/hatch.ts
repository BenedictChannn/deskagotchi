/**
 * Shared Hatch input contract and validation rules.
 *
 * @module
 */
import { z } from "zod";

import {
  AnimationId,
  ColorHexSchema,
  LifeStage,
  PackageValidationStatus,
  type PetPackage,
  PetSource,
  PlayStyle,
  type ValidationIssue,
  ValidationSeverity
} from "./domain";

/** Maximum visible pet name length accepted by Hatch. */
export const HATCH_NAME_MAX_LENGTH = 40;

/** Maximum prompt description length that still fits the generated pet manifest. */
export const HATCH_DESCRIPTION_MAX_LENGTH = 200;

/** Maximum free-form species or concept length accepted by Hatch. */
export const HATCH_SPECIES_MAX_LENGTH = 80;

/** Maximum personality descriptor length accepted by Hatch. */
export const HATCH_PERSONALITY_MAX_LENGTH = 120;

/** Maximum optional accessory or theme descriptor length accepted by Hatch. */
export const HATCH_OPTIONAL_TEXT_MAX_LENGTH = 120;

/** Placeholder Hatch packages must include every required MVP animation row. */
export const HATCH_PLACEHOLDER_ANIMATION_IDS = [
  AnimationId.Idle,
  AnimationId.Happy,
  AnimationId.Walking,
  AnimationId.Sleeping,
  AnimationId.Sick
];

/** Static note appended to local Hatch drafts until imagegen assets replace them. */
export const HATCH_PLACEHOLDER_NOTE =
  "This local draft is ready for replacement by the approved imagegen pipeline.";

const OptionalHatchTextSchema = z
  .string()
  .trim()
  .max(HATCH_OPTIONAL_TEXT_MAX_LENGTH)
  .optional();

/** Runtime-validated Hatch form payload accepted over IPC and browser dev mode. */
export const HatchDraftInputSchema = z
  .object({
    name: z.string().trim().max(HATCH_NAME_MAX_LENGTH),
    description: z.string().trim().max(HATCH_DESCRIPTION_MAX_LENGTH),
    species: z.string().trim().max(HATCH_SPECIES_MAX_LENGTH),
    personality: z.string().trim().max(HATCH_PERSONALITY_MAX_LENGTH),
    preferredColors: z.array(ColorHexSchema).min(2).max(8),
    accessory: OptionalHatchTextSchema,
    theme: OptionalHatchTextSchema
  })
  .strict();

/** Input collected by Hatch before generating or installing a draft pet package. */
export type HatchDraftInput = z.infer<typeof HatchDraftInputSchema>;

/** Inputs required to build a local Hatch package manifest. */
export interface HatchPackageOptions {
  input: HatchDraftInput;
  packageId: string;
  colorPalette: string[];
  stageThresholdHours: Record<LifeStage, number>;
  createdAt: string;
  assetHash: string;
  author: string;
  license: string;
}

const BLOCKED_HATCH_TERMS = [
  "tamagotchi",
  "bandai",
  "codex",
  "pokemon",
  "pikachu",
  "disney",
  "mario",
  "sonic",
  "hateful",
  "sexual"
];

/**
 * Validate Hatch prompt input before creating local package files.
 *
 * Args:
 *   input: Hatch prompt details from the renderer.
 *
 * Returns:
 *   Package-style validation issues for blocked or invalid input.
 */
export function validateHatchDraftInput(input: HatchDraftInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const combinedText = `${input.name} ${input.description} ${input.species} ${input.personality} ${input.accessory ?? ""} ${input.theme ?? ""}`.toLowerCase();

  for (const blockedTerm of BLOCKED_HATCH_TERMS) {
    if (combinedText.includes(blockedTerm)) {
      issues.push({
        severity: ValidationSeverity.Error,
        code: "hatch_prompt_blocked_term",
        message: `Hatch prompts cannot request protected, unsafe, or confusingly similar content: '${blockedTerm}'.`
      });
    }
  }

  if (input.name.trim().length < 1) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "hatch_name_invalid",
      message: `Pet name must be between 1 and ${HATCH_NAME_MAX_LENGTH} characters.`
    });
  }

  if (input.description.trim().length < 1) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "hatch_description_invalid",
      message: `Pet description must be between 1 and ${HATCH_DESCRIPTION_MAX_LENGTH} characters.`
    });
  }

  if (input.species.trim().length < 1) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "hatch_species_invalid",
      message: `Pet species must be between 1 and ${HATCH_SPECIES_MAX_LENGTH} characters.`
    });
  }

  if (input.personality.trim().length < 1) {
    issues.push({
      severity: ValidationSeverity.Error,
      code: "hatch_personality_invalid",
      message: `Pet personality must be between 1 and ${HATCH_PERSONALITY_MAX_LENGTH} characters.`
    });
  }

  return issues;
}

/**
 * Build the placeholder pet manifest used before generated art is approved.
 *
 * Args:
 *   options: Hatch input, package identity, timing, and attribution metadata.
 *
 * Returns:
 *   Pet package manifest for a local Hatch draft.
 */
export function createHatchPetPackage(options: HatchPackageOptions): PetPackage {
  const { input, packageId, colorPalette, stageThresholdHours } = options;
  return {
    schemaVersion: 1,
    packageId,
    packageVersion: "0.1.0",
    minAppVersion: "0.1.0",
    name: input.name.trim(),
    description: `${input.description.trim()} ${HATCH_PLACEHOLDER_NOTE}`.trim(),
    source: PetSource.Custom,
    species: input.species.trim(),
    personality: input.personality.trim(),
    createdAt: options.createdAt,
    assetVersion: "0.1.0",
    assets: {
      spritesheet: "spritesheet.svg",
      preview: "preview.svg",
      icon: "icon.svg"
    },
    animations: [
      hatchAnimation(AnimationId.Idle, 0, 6),
      hatchAnimation(AnimationId.Happy, 1, 8),
      hatchAnimation(AnimationId.Walking, 2, 7),
      hatchAnimation(AnimationId.Sleeping, 3, 2),
      hatchAnimation(AnimationId.Sick, 4, 4)
    ],
    growthStages: [
      hatchGrowthStage("egg", LifeStage.Egg, "Egg", stageThresholdHours[LifeStage.Egg]),
      hatchGrowthStage("baby", LifeStage.Baby, "Baby", stageThresholdHours[LifeStage.Baby]),
      hatchGrowthStage("child", LifeStage.Child, "Child", stageThresholdHours[LifeStage.Child]),
      hatchGrowthStage("teen", LifeStage.Teen, "Teen", stageThresholdHours[LifeStage.Teen]),
      hatchGrowthStage("adult", LifeStage.Adult, "Adult", stageThresholdHours[LifeStage.Adult])
    ],
    preferredFoods: ["custom treat"],
    dislikedFoods: ["burnt snack"],
    foodPreferences: {
      sharedFoodIds: ["meal-rice-ball", "meal-steamed-bun", "snack-biscuit"],
      likedFoodIds: ["snack-apple-slice"],
      favoriteFoodIds: ["meal-banana"],
      dislikedFoodIds: ["snack-candy"],
      eatingAnchor: { x: 0.58, y: 0.58, size: 22 }
    },
    favoritePlayStyle: PlayStyle.Calm,
    careModifiers: {
      hungerDecayMultiplier: 1,
      happinessDecayMultiplier: 1,
      energyDecayMultiplier: 1,
      cleanlinessDecayMultiplier: 1,
      affectionGainMultiplier: 1
    },
    colorPalette,
    author: options.author,
    license: options.license,
    capabilities: ["hatch-mvp", "placeholder-art"],
    validationStatus: PackageValidationStatus.Passed,
    assetHash: options.assetHash,
    generation: {
      mode: "local-placeholder",
      prompt: JSON.stringify(input),
      referenceImageStored: false
    }
  };
}

function hatchAnimation(
  id: AnimationId,
  row: number,
  fps: number
): PetPackage["animations"][number] {
  return {
    id,
    row,
    frames: 4,
    frameWidth: 96,
    frameHeight: 96,
    fps,
    loop: true,
    ...(id === AnimationId.Idle ? {} : { fallback: AnimationId.Idle })
  };
}

function hatchGrowthStage(
  id: string,
  lifeStage: LifeStage,
  label: string,
  minAgeHours: number
): PetPackage["growthStages"][number] {
  return {
    id,
    stage: lifeStage,
    label,
    minAgeHours,
    careScoreMin: 0,
    careScoreMax: 100,
    animationSet: [...HATCH_PLACEHOLDER_ANIMATION_IDS]
  };
}
