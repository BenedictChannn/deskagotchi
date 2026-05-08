import { LifeStage } from "./domain";
import {
  createHatchPetPackage,
  HATCH_PLACEHOLDER_ANIMATION_IDS,
  validateHatchDraftInput
} from "./hatch";
import { hasBlockingIssues, validatePetPackage } from "./packageValidation";

describe("hatch helpers", () => {
  it("builds package manifests that satisfy required MVP animations", () => {
    const petPackage = createHatchPetPackage({
      input: {
        name: "Momo",
        description: "A small calm test companion.",
        species: "Round desk pet",
        personality: "Gentle and curious",
        preferredColors: ["#4ecdc4", "#fff4d6"]
      },
      packageId: "momo-test",
      colorPalette: ["#4ecdc4", "#fff4d6", "#243447"],
      stageThresholdHours: {
        [LifeStage.Egg]: 0,
        [LifeStage.Baby]: 24,
        [LifeStage.Child]: 72,
        [LifeStage.Teen]: 240,
        [LifeStage.Adult]: 504
      },
      createdAt: "2026-05-08T00:00:00.000Z",
      assetHash: "momo-test-placeholder",
      author: "Local user",
      license: "Local custom Deskagotchi pet"
    });

    expect(petPackage.animations.map((animation) => animation.id)).toEqual(
      HATCH_PLACEHOLDER_ANIMATION_IDS
    );
    expect(hasBlockingIssues(validatePetPackage(petPackage))).toBe(false);
  });

  it("uses one shared validation rule set for required text fields", () => {
    expect(
      validateHatchDraftInput({
        name: "",
        description: "",
        species: "",
        personality: "",
        preferredColors: ["#4ecdc4", "#fff4d6"]
      }).map((issue) => issue.code)
    ).toEqual([
      "hatch_name_invalid",
      "hatch_description_invalid",
      "hatch_species_invalid",
      "hatch_personality_invalid"
    ]);
  });
});
