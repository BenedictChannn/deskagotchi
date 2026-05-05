import { CareActionType, LifeStage, Mood, PetLifecycleStatus } from "./domain";
import { createTestPetPackage } from "./fixtures";
import {
  applyCareAction,
  createInitialPetState,
  deriveMood,
  progressPetState
} from "./simulation";

describe("simulation", () => {
  const petPackage = createTestPetPackage();
  const startedAt = new Date("2026-05-05T00:00:00.000Z");

  it("applies bounded offline progression", () => {
    const state = createInitialPetState(petPackage, "Miso", startedAt, "miso-1");
    const result = progressPetState(
      state,
      petPackage,
      new Date("2026-05-10T00:00:00.000Z")
    );

    expect(result.state.ageHours).toBeCloseTo(120, 3);
    expect(result.state.offlineDebtHours).toBeCloseTo(84, 3);
    expect(result.state.stats.hunger).toBeGreaterThanOrEqual(0);
    expect(result.state.stats.health).toBeGreaterThanOrEqual(0);
  });

  it("tracks clock rollback without decaying state", () => {
    const state = createInitialPetState(
      petPackage,
      "Miso",
      new Date("2026-05-05T12:00:00.000Z"),
      "miso-1"
    );
    const result = progressPetState(
      state,
      petPackage,
      new Date("2026-05-05T11:00:00.000Z")
    );

    expect(result.state.clockRollbackCount).toBe(1);
    expect(result.events[0]?.code).toBe("clock_rollback");
    expect(result.state.ageHours).toBe(0);
  });

  it("applies care actions after progressing to action time", () => {
    const state = createInitialPetState(petPackage, "Miso", startedAt, "miso-1");
    const result = applyCareAction(state, petPackage, {
      type: CareActionType.FeedMeal,
      now: new Date("2026-05-05T02:00:00.000Z")
    });

    expect(result.state.ageHours).toBeCloseTo(2, 3);
    expect(result.state.stats.hunger).toBeGreaterThan(90);
  });

  it("uses deterministic mood priority", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      lifecycleStatus: PetLifecycleStatus.Sleeping,
      isSick: true,
      stats: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-2").stats,
        health: 2,
        hunger: 2
      }
    };

    expect(deriveMood(state)).toBe(Mood.Sleeping);
  });

  it("advances growth stages by age and care score", () => {
    const state = createInitialPetState(petPackage, "Miso", startedAt, "miso-1");
    const result = progressPetState(
      state,
      petPackage,
      new Date("2026-05-08T12:00:00.000Z")
    );

    expect(result.state.lifeStage).toBe(LifeStage.Adult);
  });
});
