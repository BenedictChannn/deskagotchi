/**
 * Shared domain schemas and value types for Deskagotchi gameplay.
 *
 * @module
 */
import { z } from "zod";

/** Current persisted pet package schema version accepted by the app. */
export const CURRENT_PET_PACKAGE_SCHEMA_VERSION = 1;

/** Current persisted pet instance state schema version accepted by the app. */
export const CURRENT_PET_STATE_SCHEMA_VERSION = 1;

/** Current simulation tuning schema version used by default configuration. */
export const CURRENT_SIMULATION_CONFIG_VERSION = 1;

/** Identifies whether a package ships with the app or was created by the user. */
export enum PetSource {
  BuiltIn = "built-in",
  Custom = "custom"
}

/** Coarse growth stages used by the simulation and package manifests. */
export enum LifeStage {
  Egg = "egg",
  Baby = "baby",
  Child = "child",
  Teen = "teen",
  Adult = "adult"
}

/** Renderer animation keys that packages may expose in their sprite manifests. */
export enum AnimationId {
  Idle = "idle",
  Happy = "happy",
  Sad = "sad",
  Hungry = "hungry",
  Eating = "eating",
  Playing = "playing",
  Sleeping = "sleeping",
  Sick = "sick",
  Cleaning = "cleaning",
  Walking = "walking",
  Attention = "attention"
}

/** User-facing simulation moods that map state to animation and UI feedback. */
export enum Mood {
  Idle = "idle",
  Happy = "happy",
  Sad = "sad",
  Hungry = "hungry",
  Eating = "eating",
  Playing = "playing",
  Sleeping = "sleeping",
  Sick = "sick",
  Dirty = "dirty",
  Cleaning = "cleaning",
  Attention = "attention"
}

/** Lifecycle state that controls whether a pet is simulated as active or suspended. */
export enum PetLifecycleStatus {
  Active = "active",
  Sleeping = "sleeping",
  Dormant = "dormant",
  Archived = "archived"
}

/** Validation marker stored on pet packages after authoring or import checks. */
export enum PackageValidationStatus {
  Draft = "draft",
  Passed = "passed",
  Failed = "failed"
}

/** Play interaction categories used by package personality metadata. */
export enum PlayStyle {
  Chase = "chase",
  Puzzle = "puzzle",
  Rhythm = "rhythm",
  Calm = "calm"
}

/** Discrete care commands accepted by the shared simulation layer. */
export enum CareActionType {
  FeedMeal = "feed_meal",
  FeedSnack = "feed_snack",
  Play = "play",
  Clean = "clean",
  Medicine = "medicine",
  ToggleSleep = "toggle_sleep",
  Pet = "pet"
}

/** Severity level for package and asset validation diagnostics. */
export enum ValidationSeverity {
  Error = "error",
  Warning = "warning"
}

/** Validates six-digit hex colors stored in package palettes. */
export const ColorHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Validates asset paths that remain inside a package-relative directory. */
export const SafeRelativePathSchema = z
  .string()
  .min(1)
  .max(180)
  .refine((value) => !value.startsWith("/") && !value.startsWith("\\"), {
    message: "Path must be relative."
  })
  .refine((value) => !/^[a-zA-Z]:/.test(value), {
    message: "Windows absolute paths are not allowed."
  })
  .refine((value) => !value.split(/[\\/]/).includes(".."), {
    message: "Path traversal is not allowed."
  });

/** Validates one row of a package spritesheet animation manifest. */
export const AnimationManifestEntrySchema = z.object({
  id: z.nativeEnum(AnimationId),
  row: z.number().int().min(0),
  frames: z.number().int().min(1).max(24),
  frameWidth: z.number().int().min(16).max(512),
  frameHeight: z.number().int().min(16).max(512),
  fps: z.number().min(1).max(30),
  loop: z.boolean(),
  fallback: z.nativeEnum(AnimationId).optional()
});

/** One animation row declared by a pet package manifest. */
export type AnimationManifestEntry = z.infer<
  typeof AnimationManifestEntrySchema
>;

/** Validates one package growth branch for a life stage and care-score range. */
export const GrowthStageManifestSchema = z.object({
  id: z.string().min(1).max(80),
  stage: z.nativeEnum(LifeStage),
  label: z.string().min(1).max(80),
  minAgeHours: z.number().min(0),
  careScoreMin: z.number().min(0).max(100),
  careScoreMax: z.number().min(0).max(100),
  animationSet: z.array(z.nativeEnum(AnimationId)).min(1)
});

/** Growth branch metadata used to select package art as pets age. */
export type GrowthStageManifest = z.infer<typeof GrowthStageManifestSchema>;

/** Validates installable pet package metadata, assets, growth, and modifiers. */
export const PetPackageSchema = z.object({
  schemaVersion: z.literal(CURRENT_PET_PACKAGE_SCHEMA_VERSION),
  packageId: z.string().min(3).max(80).regex(/^[a-z0-9][a-z0-9-]+$/),
  packageVersion: z.string().min(1).max(40),
  minAppVersion: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(280),
  source: z.nativeEnum(PetSource),
  species: z.string().min(1).max(80),
  personality: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
  assetVersion: z.string().min(1).max(40),
  assets: z.object({
    spritesheet: SafeRelativePathSchema,
    preview: SafeRelativePathSchema,
    icon: SafeRelativePathSchema
  }),
  animations: z.array(AnimationManifestEntrySchema).min(1),
  growthStages: z.array(GrowthStageManifestSchema).min(1),
  preferredFoods: z.array(z.string().min(1).max(40)).default([]),
  dislikedFoods: z.array(z.string().min(1).max(40)).default([]),
  favoritePlayStyle: z.nativeEnum(PlayStyle),
  careModifiers: z.object({
    hungerDecayMultiplier: z.number().min(0.25).max(3),
    happinessDecayMultiplier: z.number().min(0.25).max(3),
    energyDecayMultiplier: z.number().min(0.25).max(3),
    cleanlinessDecayMultiplier: z.number().min(0.25).max(3),
    affectionGainMultiplier: z.number().min(0.25).max(3)
  }),
  colorPalette: z.array(ColorHexSchema).min(2).max(8),
  author: z.string().min(1).max(80),
  license: z.string().min(1).max(80),
  capabilities: z.array(z.string().min(1).max(60)),
  validationStatus: z.nativeEnum(PackageValidationStatus),
  assetHash: z.string().min(1).max(128).optional(),
  generation: z
    .object({
      mode: z.enum(["manual", "local-placeholder", "imagegen"]),
      prompt: z.string().max(2000).optional(),
      referenceImageStored: z.boolean().optional()
    })
    .optional()
});

/** Installable pet package manifest consumed by registry, renderer, and simulation. */
export type PetPackage = z.infer<typeof PetPackageSchema>;

/** Validates bounded gameplay stats persisted on each pet instance. */
export const PetStatsSchema = z.object({
  hunger: z.number().min(0).max(100),
  happiness: z.number().min(0).max(100),
  energy: z.number().min(0).max(100),
  cleanliness: z.number().min(0).max(100),
  health: z.number().min(0).max(100),
  affection: z.number().min(0).max(100),
  discipline: z.number().min(0).max(100),
  weight: z.number().min(1).max(999)
});

/** Mutable gameplay stats for a single pet instance. */
export type PetStats = z.infer<typeof PetStatsSchema>;

/** Validates rolling care-quality counters used for growth and consequences. */
export const CareHistorySchema = z.object({
  missedCareTicks: z.number().int().min(0),
  sickHours: z.number().min(0),
  messHours: z.number().min(0),
  lowHungerHours: z.number().min(0),
  sleepDebtHours: z.number().min(0),
  playCount: z.number().int().min(0),
  snackCount: z.number().int().min(0),
  medicineDelayHours: z.number().min(0),
  careMistakes: z.number().int().min(0),
  qualityScore: z.number().min(0).max(100)
});

/** Rolling care-quality counters retained between simulation ticks. */
export type CareHistory = z.infer<typeof CareHistorySchema>;

/** Validates one persisted pet instance and its gameplay state. */
export const PetInstanceStateSchema = z.object({
  schemaVersion: z.literal(CURRENT_PET_STATE_SCHEMA_VERSION),
  instanceId: z.string().min(3).max(100),
  packageId: z.string().min(3).max(80),
  nickname: z.string().min(1).max(60),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSimulatedAt: z.string().datetime(),
  lifecycleStatus: z.nativeEnum(PetLifecycleStatus),
  lifeStage: z.nativeEnum(LifeStage),
  growthStageId: z.string().min(1).max(80),
  ageHours: z.number().min(0),
  mood: z.nativeEnum(Mood),
  isSick: z.boolean(),
  messCount: z.number().int().min(0).max(5),
  clockRollbackCount: z.number().int().min(0),
  offlineDebtHours: z.number().min(0),
  stats: PetStatsSchema,
  careHistory: CareHistorySchema
});

/** Persisted gameplay state for one hatched pet instance. */
export type PetInstanceState = z.infer<typeof PetInstanceStateSchema>;

/** Validates the top-level Deskagotchi save file shared across app processes. */
export const DeskagotchiSaveSchema = z.object({
  schemaVersion: z.literal(1),
  activeInstanceId: z.string().min(3).max(100),
  instances: z.array(PetInstanceStateSchema),
  settings: z.object({
    alwaysOnTop: z.boolean(),
    launchOnStartup: z.boolean(),
    soundEnabled: z.boolean(),
    reducedMotion: z.boolean(),
    lowMaintenanceMode: z.boolean(),
    quietHoursEnabled: z.boolean(),
    quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
    quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
    notificationsEnabled: z.boolean(),
    notificationCooldownMinutes: z.number().int().min(5).max(1440),
    clickThroughWhenIdle: z.boolean(),
    petWindowBounds: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().int().min(96).max(512),
        height: z.number().int().min(96).max(512)
      })
      .optional()
  })
});

/** Top-level persisted save data, including instances and desktop settings. */
export type DeskagotchiSave = z.infer<typeof DeskagotchiSaveSchema>;

/** Human-readable validation diagnostic returned by package checks. */
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
}
