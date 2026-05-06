import {
  AnimationId,
  CareActionType,
  LifeStage,
  Mood,
  PetLifecycleStatus
} from "./domain";
import { createTestPetPackage } from "./fixtures";
import {
  applyCareAction,
  createInitialPetState,
  deriveMood,
  moodToAnimation,
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
    expect(result.state.mood).toBe(Mood.Eating);
  });

  it("keeps immediate action moods visible for renderer feedback", () => {
    const state = createInitialPetState(petPackage, "Miso", startedAt, "miso-1");
    const playResult = applyCareAction(state, petPackage, {
      type: CareActionType.Play,
      now: new Date("2026-05-05T00:01:00.000Z")
    });
    const cleanResult = applyCareAction(state, petPackage, {
      type: CareActionType.Clean,
      now: new Date("2026-05-05T00:01:00.000Z")
    });

    expect(playResult.state.mood).toBe(Mood.Playing);
    expect(cleanResult.state.mood).toBe(Mood.Cleaning);
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

  it("uses walking as a deterministic healthy ambient mood", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      ageHours: 0.25,
      lifeStage: LifeStage.Baby
    };

    expect(deriveMood(state)).toBe(Mood.Walking);
    expect(moodToAnimation(Mood.Walking)).toBe(AnimationId.Walking);
  });

  it("selects competing growth branches by age and care score", () => {
    const adultAnimationSet = [
      AnimationId.Idle,
      AnimationId.Happy,
      AnimationId.Walking,
      AnimationId.Sleeping,
      AnimationId.Sick
    ];
    const branchedPetPackage = createTestPetPackage({
      growthStages: [
        ...petPackage.growthStages.filter(
          (growthStage) => growthStage.stage !== LifeStage.Adult
        ),
        {
          id: "adult-steady",
          stage: LifeStage.Adult,
          label: "Steady Adult",
          minAgeHours: 72,
          careScoreMin: 0,
          careScoreMax: 49,
          animationSet: adultAnimationSet
        },
        {
          id: "adult-star",
          stage: LifeStage.Adult,
          label: "Star Adult",
          minAgeHours: 72,
          careScoreMin: 50,
          careScoreMax: 100,
          animationSet: adultAnimationSet
        }
      ]
    });
    const simulationTime = new Date("2026-05-08T00:00:00.000Z");
    const adultState = {
      ...createInitialPetState(branchedPetPackage, "Miso", simulationTime, "miso-1"),
      ageHours: 72
    };
    const lowCareResult = progressPetState(
      {
        ...adultState,
        careHistory: {
          ...adultState.careHistory,
          qualityScore: 35
        }
      },
      branchedPetPackage,
      simulationTime
    );
    const highCareResult = progressPetState(
      {
        ...adultState,
        instanceId: "miso-2",
        careHistory: {
          ...adultState.careHistory,
          qualityScore: 85
        }
      },
      branchedPetPackage,
      simulationTime
    );

    expect(lowCareResult.state.lifeStage).toBe(LifeStage.Adult);
    expect(lowCareResult.state.growthStageId).toBe("adult-steady");
    expect(highCareResult.state.lifeStage).toBe(LifeStage.Adult);
    expect(highCareResult.state.growthStageId).toBe("adult-star");
  });
});
