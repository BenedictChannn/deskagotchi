import { AnimationId, PackageValidationStatus } from "./domain";
import { createTestPetPackage } from "./fixtures";
import {
  hasBlockingIssues,
  parsePetPackage,
  validatePetPackage
} from "./packageValidation";

describe("package validation", () => {
  it("accepts a valid package", () => {
    const issues = validatePetPackage(createTestPetPackage());

    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("rejects path traversal at schema parse time", () => {
    const parsed = parsePetPackage(
      createTestPetPackage({
        assets: {
          spritesheet: "../escape.svg",
          preview: "preview.svg",
          icon: "icon.svg"
        }
      })
    );

    expect(parsed.package).toBeUndefined();
    expect(parsed.issues.some((issue) => issue.code === "schema_invalid")).toBe(true);
  });

  it("rejects passed packages that miss required MVP animations", () => {
    const petPackage = createTestPetPackage({
      animations: createTestPetPackage().animations.filter(
        (animation) => animation.id !== AnimationId.Walking
      ),
      validationStatus: PackageValidationStatus.Passed
    });
    const issues = validatePetPackage(petPackage);

    expect(
      issues.some(
        (issue) =>
          issue.code === "missing_required_animation" &&
          issue.message.includes(AnimationId.Walking)
      )
    ).toBe(true);
    expect(issues.some((issue) => issue.code === "passed_package_has_errors")).toBe(
      true
    );
  });
});
