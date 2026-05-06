/**
 * Shared test fixtures for gameplay and package validation.
 *
 * @module
 */
import {
  AnimationId,
  LifeStage,
  PackageValidationStatus,
  PetSource,
  PlayStyle,
  type PetPackage
} from "./domain";

/**
 * Creates a schema-valid package for shared-layer tests.
 *
 * @param overrides Partial manifest fields to merge into the default package.
 * @returns A complete pet package suitable for simulation and validation tests.
 */
export function createTestPetPackage(overrides: Partial<PetPackage> = {}): PetPackage {
  return {
    schemaVersion: 1,
    packageId: "deskcat",
    packageVersion: "0.1.0",
    minAppVersion: "0.1.0",
    name: "Deskcat",
    description: "A small original cat-like desk companion.",
    source: PetSource.BuiltIn,
    species: "Cat-like desk companion",
    personality: "Curious, alert, and fond of tiny keyboard patrols.",
    createdAt: "2026-05-05T00:00:00.000Z",
    assetVersion: "0.1.0",
    assets: {
      spritesheet: "spritesheet.svg",
      preview: "preview.svg",
      icon: "icon.svg"
    },
    animations: [
      {
        id: AnimationId.Idle,
        row: 0,
        frames: 4,
        frameWidth: 96,
        frameHeight: 96,
        fps: 6,
        loop: true
      },
      {
        id: AnimationId.Happy,
        row: 1,
        frames: 4,
        frameWidth: 96,
        frameHeight: 96,
        fps: 8,
        loop: true,
        fallback: AnimationId.Idle
      },
      {
        id: AnimationId.Walking,
        row: 2,
        frames: 4,
        frameWidth: 96,
        frameHeight: 96,
        fps: 8,
        loop: true,
        fallback: AnimationId.Idle
      },
      {
        id: AnimationId.Sleeping,
        row: 3,
        frames: 2,
        frameWidth: 96,
        frameHeight: 96,
        fps: 2,
        loop: true,
        fallback: AnimationId.Idle
      },
      {
        id: AnimationId.Sick,
        row: 4,
        frames: 2,
        frameWidth: 96,
        frameHeight: 96,
        fps: 3,
        loop: true,
        fallback: AnimationId.Idle
      }
    ],
    growthStages: [
      {
        id: "egg",
        stage: LifeStage.Egg,
        label: "Egg",
        minAgeHours: 0,
        careScoreMin: 0,
        careScoreMax: 100,
        animationSet: [AnimationId.Idle, AnimationId.Sleeping]
      },
      {
        id: "baby",
        stage: LifeStage.Baby,
        label: "Baby",
        minAgeHours: 2,
        careScoreMin: 0,
        careScoreMax: 100,
        animationSet: [
          AnimationId.Idle,
          AnimationId.Happy,
          AnimationId.Walking,
          AnimationId.Sleeping,
          AnimationId.Sick
        ]
      },
      {
        id: "adult",
        stage: LifeStage.Adult,
        label: "Adult",
        minAgeHours: 72,
        careScoreMin: 0,
        careScoreMax: 100,
        animationSet: [
          AnimationId.Idle,
          AnimationId.Happy,
          AnimationId.Walking,
          AnimationId.Sleeping,
          AnimationId.Sick
        ]
      }
    ],
    preferredFoods: ["fish biscuit", "warm rice"],
    dislikedFoods: ["burnt toast"],
    favoritePlayStyle: PlayStyle.Chase,
    careModifiers: {
      hungerDecayMultiplier: 1,
      happinessDecayMultiplier: 1,
      energyDecayMultiplier: 1,
      cleanlinessDecayMultiplier: 1,
      affectionGainMultiplier: 1
    },
    colorPalette: ["#f7b267", "#f79d65", "#2f243a"],
    author: "Deskagotchi",
    license: "Original Deskagotchi asset",
    capabilities: ["mvp-animation", "growth-v1"],
    validationStatus: PackageValidationStatus.Passed,
    ...overrides
  };
}
