import { z } from "zod";

export const CURRENT_PET_PACKAGE_SCHEMA_VERSION = 1;
export const CURRENT_PET_STATE_SCHEMA_VERSION = 1;
export const CURRENT_SIMULATION_CONFIG_VERSION = 1;

export enum PetSource {
  BuiltIn = "built-in",
  Custom = "custom"
}

export enum LifeStage {
  Egg = "egg",
  Baby = "baby",
  Child = "child",
  Teen = "teen",
  Adult = "adult"
}

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

export enum PetLifecycleStatus {
  Active = "active",
  Sleeping = "sleeping",
  Dormant = "dormant",
  Archived = "archived"
}

export enum PackageValidationStatus {
  Draft = "draft",
  Passed = "passed",
  Failed = "failed"
}

export enum PlayStyle {
  Chase = "chase",
  Puzzle = "puzzle",
  Rhythm = "rhythm",
  Calm = "calm"
}

export enum CareActionType {
  FeedMeal = "feed_meal",
  FeedSnack = "feed_snack",
  Play = "play",
  Clean = "clean",
  Medicine = "medicine",
  ToggleSleep = "toggle_sleep",
  Pet = "pet"
}

export enum ValidationSeverity {
  Error = "error",
  Warning = "warning"
}

export const ColorHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

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

export type AnimationManifestEntry = z.infer<
  typeof AnimationManifestEntrySchema
>;

export const GrowthStageManifestSchema = z.object({
  id: z.string().min(1).max(80),
  stage: z.nativeEnum(LifeStage),
  label: z.string().min(1).max(80),
  minAgeHours: z.number().min(0),
  careScoreMin: z.number().min(0).max(100),
  careScoreMax: z.number().min(0).max(100),
  animationSet: z.array(z.nativeEnum(AnimationId)).min(1)
});

export type GrowthStageManifest = z.infer<typeof GrowthStageManifestSchema>;

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

export type PetPackage = z.infer<typeof PetPackageSchema>;

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

export type PetStats = z.infer<typeof PetStatsSchema>;

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

export type CareHistory = z.infer<typeof CareHistorySchema>;

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

export type PetInstanceState = z.infer<typeof PetInstanceStateSchema>;

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

export type DeskagotchiSave = z.infer<typeof DeskagotchiSaveSchema>;

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
}
