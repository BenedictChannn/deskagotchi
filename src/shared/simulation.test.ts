import {
  AnimationId,
  CareActionType,
  LifeStage,
  Mood,
  PetLifecycleStatus
} from "./domain";
import { createTestPetPackage } from "./fixtures";
import { ItemCategory, type ItemCatalogEntry } from "./itemIcons";
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

  it("starts care deadlines before counting missed care mistakes", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      stats: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-2").stats,
        hunger: 19
      }
    };
    const result = progressPetState(
      state,
      petPackage,
      new Date("2026-05-05T01:00:00.000Z")
    );

    expect(result.state.careDeadlines?.hunger).toBe(
      "2026-05-05T04:15:00.000Z"
    );
    expect(result.state.careHistory.careMistakes).toBe(0);
  });

  it("counts a care mistake when an explicit care deadline expires", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      careDeadlines: {
        hunger: "2026-05-05T00:30:00.000Z",
        happiness: null,
        mess: null,
        sickness: null,
        sleep: null
      },
      stats: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-2").stats,
        hunger: 10
      }
    };
    const result = progressPetState(
      state,
      petPackage,
      new Date("2026-05-05T01:00:00.000Z")
    );

    expect(result.state.careHistory.careMistakes).toBe(1);
    expect(result.state.careDeadlines?.hunger).toBe(
      "2026-05-05T04:30:00.000Z"
    );
    expect(result.events.map((event) => event.code)).toContain(
      "care_deadline_missed"
    );
  });

  it("clears resolved care deadlines when the user handles the need", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      careDeadlines: {
        hunger: "2026-05-05T01:00:00.000Z",
        happiness: null,
        mess: null,
        sickness: null,
        sleep: null
      },
      stats: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-2").stats,
        hunger: 5
      }
    };
    const result = applyCareAction(state, petPackage, {
      type: CareActionType.FeedMeal,
      now: startedAt
    });

    expect(result.state.careDeadlines?.hunger).toBeNull();
  });

  it("applies selected meal effects instead of generic feeding", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      stats: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-2").stats,
        hunger: 40,
        happiness: 50,
        weight: 10
      }
    };
    const result = applyCareAction(state, petPackage, {
      type: CareActionType.FeedMeal,
      now: startedAt,
      item: testItem("meal-rice-ball", ItemCategory.Meal, {
        hunger: 18,
        happiness: 2
      })
    });

    expect(result.state.stats.hunger).toBe(58);
    expect(result.state.stats.happiness).toBe(52);
    expect(result.state.stats.weight).toBe(10);
    expect(result.state.mood).toBe(Mood.Eating);
  });

  it("adds small preference bonuses for favorite foods", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      stats: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-2").stats,
        hunger: 40,
        happiness: 50,
        affection: 20,
        health: 80
      }
    };
    const result = applyCareAction(state, petPackage, {
      type: CareActionType.FeedMeal,
      now: startedAt,
      item: testItem("meal-fish-bite", ItemCategory.Meal, {
        hunger: 19,
        happiness: 3
      })
    });

    expect(result.state.stats.hunger).toBe(59);
    expect(result.state.stats.happiness).toBe(57);
    expect(result.state.stats.affection).toBe(23);
    expect(result.state.stats.health).toBe(81);
  });

  it("applies selected snack effects and tracks snack count", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      stats: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-2").stats,
        happiness: 40,
        health: 80,
        weight: 10
      }
    };
    const result = applyCareAction(state, petPackage, {
      type: CareActionType.FeedSnack,
      now: startedAt,
      item: testItem("snack-candy", ItemCategory.Snack, {
        happiness: 13,
        health: -2,
        weight: 1
      })
    });

    expect(result.state.stats.happiness).toBe(53);
    expect(result.state.stats.health).toBe(78);
    expect(result.state.stats.weight).toBe(11);
    expect(result.state.careHistory.snackCount).toBe(
      state.careHistory.snackCount + 1
    );
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

  it("preserves short action feedback through immediate snapshot refreshes", () => {
    const state = createInitialPetState(petPackage, "Miso", startedAt, "miso-1");
    const actionTime = new Date("2026-05-05T00:01:00.000Z");
    const feedResult = applyCareAction(state, petPackage, {
      type: CareActionType.FeedMeal,
      now: actionTime
    });
    const immediateRefresh = progressPetState(
      feedResult.state,
      petPackage,
      new Date("2026-05-05T00:01:02.000Z")
    );
    const laterRefresh = progressPetState(
      feedResult.state,
      petPackage,
      new Date("2026-05-05T00:01:06.000Z")
    );

    expect(immediateRefresh.state.mood).toBe(Mood.Eating);
    expect(laterRefresh.state.mood).not.toBe(Mood.Eating);
  });

  it("cleans messes and restores cleanliness", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      messCount: 2,
      stats: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-2").stats,
        cleanliness: 24,
        health: 50
      }
    };
    const result = applyCareAction(state, petPackage, {
      type: CareActionType.Clean,
      now: startedAt
    });

    expect(result.state.messCount).toBe(0);
    expect(result.state.stats.cleanliness).toBe(100);
    expect(result.state.stats.health).toBe(55);
    expect(result.state.mood).toBe(Mood.Cleaning);
  });

  it("uses medicine to cure sickness", () => {
    const state = {
      ...createInitialPetState(petPackage, "Miso", startedAt, "miso-1"),
      isSick: true,
      careHistory: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-2").careHistory,
        medicineDelayHours: 3
      },
      stats: {
        ...createInitialPetState(petPackage, "Miso", startedAt, "miso-3").stats,
        health: 20,
        happiness: 70
      }
    };
    const result = applyCareAction(state, petPackage, {
      type: CareActionType.Medicine,
      now: startedAt
    });

    expect(result.state.isSick).toBe(false);
    expect(result.state.stats.health).toBe(55);
    expect(result.state.stats.happiness).toBe(66);
    expect(result.state.careHistory.medicineDelayHours).toBe(0);
  });

  it("toggles sleep and derives sleeping mood", () => {
    const state = createInitialPetState(petPackage, "Miso", startedAt, "miso-1");
    const sleepResult = applyCareAction(state, petPackage, {
      type: CareActionType.ToggleSleep,
      now: startedAt
    });
    const wakeResult = applyCareAction(sleepResult.state, petPackage, {
      type: CareActionType.ToggleSleep,
      now: startedAt
    });

    expect(sleepResult.state.lifecycleStatus).toBe(PetLifecycleStatus.Sleeping);
    expect(sleepResult.state.mood).toBe(Mood.Sleeping);
    expect(wakeResult.state.lifecycleStatus).toBe(PetLifecycleStatus.Active);
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

  it("uses long-term day-scale growth thresholds", () => {
    const state = createInitialPetState(petPackage, "Miso", startedAt, "miso-1");
    const babyResult = progressPetState(
      state,
      petPackage,
      new Date("2026-05-06T00:00:00.000Z")
    );
    const adultResult = progressPetState(
      state,
      petPackage,
      new Date("2026-05-26T00:00:00.000Z")
    );

    expect(babyResult.state.lifeStage).toBe(LifeStage.Baby);
    expect(adultResult.state.lifeStage).toBe(LifeStage.Adult);
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
          minAgeHours: 504,
          careScoreMin: 0,
          careScoreMax: 49,
          animationSet: adultAnimationSet
        },
        {
          id: "adult-star",
          stage: LifeStage.Adult,
          label: "Star Adult",
          minAgeHours: 504,
          careScoreMin: 50,
          careScoreMax: 100,
          animationSet: adultAnimationSet
        }
      ]
    });
    const simulationTime = new Date("2026-05-08T00:00:00.000Z");
    const adultState = {
      ...createInitialPetState(branchedPetPackage, "Miso", simulationTime, "miso-1"),
      ageHours: 504
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

function testItem(
  id: string,
  category: ItemCategory,
  effects: ItemCatalogEntry["effects"]
): ItemCatalogEntry {
  return {
    id,
    label: id,
    category,
    iconId: "bowl",
    quantity: "unlimited",
    availability: "always",
    tags: [],
    effects
  };
}
