/**
 * Shared pet simulation rules for offline progression and care actions.
 *
 * @module
 */
import {
  AnimationId,
  CareActionType,
  type CareDeadlines,
  type CareHistory,
  CURRENT_SIMULATION_CONFIG_VERSION,
  LifeStage,
  Mood,
  type PetInstanceState,
  type PetPackage,
  type PetStats,
  PetLifecycleStatus
} from "./domain";
import { applyFoodPreferenceModifiers } from "./food";
import { ItemCategory, type ItemCatalogEntry } from "./itemIcons";

/** Tunable constants that control offline catch-up, decay, and growth timing. */
export interface SimulationConfig {
  version: typeof CURRENT_SIMULATION_CONFIG_VERSION;
  tickMinutes: number;
  maxOfflineCatchupHours: number;
  actionFeedbackDurationSeconds: number;
  maxMessCount: number;
  decayPerHour: {
    hunger: number;
    happiness: number;
    energy: number;
    cleanliness: number;
  };
  sleepRecoveryPerHour: number;
  healthPenaltyPerHour: number;
  careHistoryWindowHours: number;
  careDeadlineHours: {
    hunger: number;
    happiness: number;
    mess: number;
    sickness: number;
    sleep: number;
  };
  stageThresholdHours: Record<LifeStage, number>;
}

const HOURS_PER_DAY = 24;

/** Default long-term companion growth thresholds, stored as simulation hours. */
export const DEFAULT_STAGE_THRESHOLD_HOURS: Record<LifeStage, number> = {
  [LifeStage.Egg]: 0,
  [LifeStage.Baby]: HOURS_PER_DAY,
  [LifeStage.Child]: 3 * HOURS_PER_DAY,
  [LifeStage.Teen]: 10 * HOURS_PER_DAY,
  [LifeStage.Adult]: 21 * HOURS_PER_DAY
};

/** Default deadlines before an unresolved urgent need becomes a care mistake. */
export const DEFAULT_CARE_DEADLINE_HOURS: SimulationConfig["careDeadlineHours"] = {
  hunger: 4,
  happiness: 8,
  mess: 6,
  sickness: 18,
  sleep: 2
};

const EMPTY_CARE_DEADLINES: CareDeadlines = {
  hunger: null,
  happiness: null,
  mess: null,
  sickness: null,
  sleep: null
};

/** Domain event emitted when simulation detects a notable state transition. */
export interface SimulationEvent {
  code: string;
  message: string;
  occurredAt: string;
}

/** User care command scheduled at a specific wall-clock time. */
export interface CareAction {
  type: CareActionType;
  now: Date;
  item?: ItemCatalogEntry;
}

/** Default simulation balance used by the desktop runtime and tests. */
export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  version: CURRENT_SIMULATION_CONFIG_VERSION,
  tickMinutes: 15,
  maxOfflineCatchupHours: 36,
  actionFeedbackDurationSeconds: 4,
  maxMessCount: 5,
  decayPerHour: {
    hunger: 2.6,
    happiness: 1.7,
    energy: 1.4,
    cleanliness: 1.9
  },
  sleepRecoveryPerHour: 8,
  healthPenaltyPerHour: 3.2,
  careHistoryWindowHours: 72,
  careDeadlineHours: DEFAULT_CARE_DEADLINE_HOURS,
  stageThresholdHours: DEFAULT_STAGE_THRESHOLD_HOURS
};

/**
 * Creates the first persisted state for a newly hatched pet.
 *
 * @param petPackage Package manifest that supplies growth stages and identity.
 * @param nickname User-facing nickname stored on the pet instance.
 * @param now Creation time used for all initial timestamps.
 * @param instanceId Optional stable id for tests or import flows.
 * @returns A new pet instance initialized with baseline stats and care history.
 */
export function createInitialPetState(
  petPackage: PetPackage,
  nickname: string,
  now: Date,
  instanceId = `${petPackage.packageId}-${now.getTime()}`
): PetInstanceState {
  const firstGrowthStage = petPackage.growthStages
    .slice()
    .sort((left, right) => left.minAgeHours - right.minAgeHours)[0];

  return {
    schemaVersion: 1,
    instanceId,
    packageId: petPackage.packageId,
    nickname,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lastSimulatedAt: now.toISOString(),
    lifecycleStatus: PetLifecycleStatus.Active,
    lifeStage: firstGrowthStage.stage,
    growthStageId: firstGrowthStage.id,
    ageHours: 0,
    mood: Mood.Idle,
    isSick: false,
    messCount: 0,
    clockRollbackCount: 0,
    offlineDebtHours: 0,
    careDeadlines: { ...EMPTY_CARE_DEADLINES },
    stats: {
      hunger: 82,
      happiness: 78,
      energy: 72,
      cleanliness: 86,
      health: 92,
      affection: 20,
      discipline: 35,
      weight: 12
    },
    careHistory: {
      missedCareTicks: 0,
      sickHours: 0,
      messHours: 0,
      lowHungerHours: 0,
      sleepDebtHours: 0,
      playCount: 0,
      snackCount: 0,
      medicineDelayHours: 0,
      careMistakes: 0,
      qualityScore: 78
    }
  };
}

/**
 * Advances a pet from its last simulation timestamp to the provided time.
 *
 * Offline catch-up is capped by configuration, while leftover elapsed time is
 * tracked as debt so the pet can still age without applying unbounded decay.
 *
 * @param state Current persisted pet state.
 * @param petPackage Package manifest that supplies care modifiers and growth data.
 * @param now Wall-clock time to simulate up to.
 * @param config Optional simulation tuning override.
 * @returns Updated state plus domain events emitted during progression.
 */
export function progressPetState(
  state: PetInstanceState,
  petPackage: PetPackage,
  now: Date,
  config = DEFAULT_SIMULATION_CONFIG
): { state: PetInstanceState; events: SimulationEvent[] } {
  const lastSimulatedAt = new Date(state.lastSimulatedAt);
  const elapsedMs = now.getTime() - lastSimulatedAt.getTime();

  if (elapsedMs < 0) {
    const updatedState = {
      ...state,
      updatedAt: now.toISOString(),
      lastSimulatedAt: now.toISOString(),
      clockRollbackCount: state.clockRollbackCount + 1
    };
    return {
      state: updatedState,
      events: [
        {
          code: "clock_rollback",
          message: "System clock moved backward; simulation was clamped.",
          occurredAt: now.toISOString()
        }
      ]
    };
  }

  const elapsedHours = elapsedMs / 3_600_000;
  const effectiveHours = Math.min(elapsedHours, config.maxOfflineCatchupHours);
  const offlineDebtHours = Math.max(0, elapsedHours - effectiveHours);
  const tickHours = config.tickMinutes / 60;
  const fullTicks = Math.floor(effectiveHours / tickHours);
  const remainderHours = effectiveHours - fullTicks * tickHours;
  const events: SimulationEvent[] = [];

  let progressedState: PetInstanceState = {
    ...state,
    stats: { ...state.stats },
    careHistory: { ...state.careHistory },
    careDeadlines: normalizeCareDeadlines(state.careDeadlines),
    offlineDebtHours: state.offlineDebtHours + offlineDebtHours
  };
  const lastSimulatedAtMs = lastSimulatedAt.getTime();

  for (let tick = 0; tick < fullTicks; tick += 1) {
    const tickNow = new Date(lastSimulatedAtMs + (tick + 1) * tickHours * 3_600_000);
    progressedState = applySimulationTick(
      progressedState,
      petPackage,
      tickHours,
      config,
      tickNow,
      events
    );
  }

  if (remainderHours > 0) {
    const tickNow = new Date(lastSimulatedAtMs + effectiveHours * 3_600_000);
    progressedState = applySimulationTick(
      progressedState,
      petPackage,
      remainderHours,
      config,
      tickNow,
      events
    );
  }

  if (offlineDebtHours > 0) {
    progressedState = {
      ...progressedState,
      ageHours: progressedState.ageHours + offlineDebtHours
    };
  }

  const growthState = applyGrowth(progressedState, petPackage, config);
  const mood = deriveProgressedMood(
    state,
    growthState,
    elapsedMs,
    config.actionFeedbackDurationSeconds
  );

  return {
    state: {
      ...growthState,
      mood,
      updatedAt: now.toISOString(),
      lastSimulatedAt: now.toISOString()
    },
    events
  };
}

/**
 * Progresses the pet to the action time, then applies one care command.
 *
 * @param state Current persisted pet state.
 * @param petPackage Package manifest that supplies care modifiers.
 * @param action Care command and timestamp.
 * @param config Optional simulation tuning override.
 * @returns Updated state plus any progression events emitted before the action.
 */
export function applyCareAction(
  state: PetInstanceState,
  petPackage: PetPackage,
  action: CareAction,
  config = DEFAULT_SIMULATION_CONFIG
): { state: PetInstanceState; events: SimulationEvent[] } {
  const progressed = progressPetState(state, petPackage, action.now, config);
  const nextState = applyActionEffects(
    progressed.state,
    action.type,
    petPackage,
    action.item
  );

  return {
    state: {
      ...nextState,
      mood: deriveActionMood(nextState, action.type),
      updatedAt: action.now.toISOString(),
      lastSimulatedAt: action.now.toISOString()
    },
    events: progressed.events
  };
}

/**
 * Derives the highest-priority mood implied by the current state.
 *
 * @param state Current pet state after progression or care effects.
 * @returns The mood the renderer should use for idle feedback.
 */
export function deriveMood(state: PetInstanceState): Mood {
  if (state.lifecycleStatus === PetLifecycleStatus.Sleeping) {
    return Mood.Sleeping;
  }

  if (state.isSick || state.stats.health < 25) {
    return Mood.Sick;
  }

  if (state.messCount > 0 || state.stats.cleanliness < 25) {
    return Mood.Dirty;
  }

  if (state.stats.hunger < 28) {
    return Mood.Hungry;
  }

  if (state.stats.happiness < 28 || state.stats.energy < 18) {
    return Mood.Sad;
  }

  if (state.stats.happiness > 78 && state.stats.affection > 45) {
    return Mood.Happy;
  }

  if (shouldUseAmbientWalkingMood(state)) {
    return Mood.Walking;
  }

  return Mood.Idle;
}

/**
 * Maps a simulation mood to the package animation id expected by the renderer.
 *
 * @param mood Mood derived from pet state or immediate action feedback.
 * @returns The animation id that best represents the mood.
 */
export function moodToAnimation(mood: Mood): AnimationId {
  switch (mood) {
    case Mood.Happy:
      return AnimationId.Happy;
    case Mood.Sad:
      return AnimationId.Sad;
    case Mood.Hungry:
      return AnimationId.Hungry;
    case Mood.Eating:
      return AnimationId.Eating;
    case Mood.Playing:
      return AnimationId.Playing;
    case Mood.Sleeping:
      return AnimationId.Sleeping;
    case Mood.Sick:
      return AnimationId.Sick;
    case Mood.Dirty:
    case Mood.Cleaning:
      return AnimationId.Cleaning;
    case Mood.Walking:
      return AnimationId.Walking;
    case Mood.Attention:
      return AnimationId.Attention;
    case Mood.Idle:
      return AnimationId.Idle;
  }
}

function shouldUseAmbientWalkingMood(state: PetInstanceState): boolean {
  if (state.lifeStage === LifeStage.Egg) {
    return false;
  }

  if (
    state.stats.energy < 45 ||
    state.stats.hunger < 45 ||
    state.stats.cleanliness < 45 ||
    state.stats.health < 45
  ) {
    return false;
  }

  return Math.floor(state.ageHours * 4) % 4 === 1;
}

function deriveProgressedMood(
  previousState: PetInstanceState,
  progressedState: PetInstanceState,
  elapsedMs: number,
  actionFeedbackDurationSeconds: number
): Mood {
  const actionFeedbackDurationMs = actionFeedbackDurationSeconds * 1000;
  if (
    elapsedMs <= actionFeedbackDurationMs &&
    isTransientActionMood(previousState.mood)
  ) {
    return previousState.mood;
  }

  return deriveMood(progressedState);
}

function isTransientActionMood(mood: Mood): boolean {
  return (
    mood === Mood.Eating ||
    mood === Mood.Playing ||
    mood === Mood.Cleaning ||
    mood === Mood.Happy
  );
}

function deriveActionMood(
  state: PetInstanceState,
  actionType: CareActionType
): Mood {
  switch (actionType) {
    case CareActionType.FeedMeal:
    case CareActionType.FeedSnack:
      return Mood.Eating;
    case CareActionType.Play:
      return Mood.Playing;
    case CareActionType.Clean:
      return Mood.Cleaning;
    case CareActionType.Medicine:
    case CareActionType.Pet:
      return Mood.Happy;
    case CareActionType.ToggleSleep:
      return deriveMood(state);
  }
}

function applySimulationTick(
  state: PetInstanceState,
  petPackage: PetPackage,
  tickHours: number,
  config: SimulationConfig,
  now: Date,
  events: SimulationEvent[]
): PetInstanceState {
  const sleeping = state.lifecycleStatus === PetLifecycleStatus.Sleeping;
  const stats: PetStats = {
    ...state.stats,
    hunger: clampStat(
      state.stats.hunger -
        config.decayPerHour.hunger *
          petPackage.careModifiers.hungerDecayMultiplier *
          tickHours
    ),
    happiness: clampStat(
      state.stats.happiness -
        config.decayPerHour.happiness *
          petPackage.careModifiers.happinessDecayMultiplier *
          tickHours
    ),
    energy: clampStat(
      sleeping
        ? state.stats.energy + config.sleepRecoveryPerHour * tickHours
        : state.stats.energy -
            config.decayPerHour.energy *
              petPackage.careModifiers.energyDecayMultiplier *
              tickHours
    ),
    cleanliness: clampStat(
      state.stats.cleanliness -
        config.decayPerHour.cleanliness *
          petPackage.careModifiers.cleanlinessDecayMultiplier *
          tickHours
    )
  };

  const lowCare =
    stats.hunger < 25 || stats.cleanliness < 25 || stats.energy < 15;
  const healthPenalty = lowCare ? config.healthPenaltyPerHour * tickHours : 0;
  stats.health = clampStat(state.stats.health - healthPenalty);
  stats.affection = clampStat(state.stats.affection - (lowCare ? 0.25 : 0) * tickHours);
  stats.discipline = state.stats.discipline;
  stats.weight = clampWeight(state.stats.weight - (stats.hunger < 15 ? 0.03 : 0));

  const messCount = nextMessCount(state.messCount, stats.cleanliness, config);
  const isSick = state.isSick || stats.health < 22;
  const baseCareHistory = nextCareHistory(
    state.careHistory,
    tickHours,
    stats,
    isSick,
    messCount,
    lowCare,
    config
  );
  const deadlineResult = nextCareDeadlines(
    normalizeCareDeadlines(state.careDeadlines),
    stats,
    isSick,
    messCount,
    sleeping,
    now,
    config,
    events
  );
  const careHistory = {
    ...baseCareHistory,
    careMistakes: baseCareHistory.careMistakes + deadlineResult.missedCareCount
  };

  if (!state.isSick && isSick) {
    events.push({
      code: "became_sick",
      message: `${state.nickname} became sick and needs medicine.`,
      occurredAt: now.toISOString()
    });
  }

  return {
    ...state,
    ageHours: state.ageHours + tickHours,
    stats,
    messCount,
    isSick,
    careHistory,
    careDeadlines: deadlineResult.deadlines
  };
}

function applyActionEffects(
  state: PetInstanceState,
  actionType: CareActionType,
  petPackage: PetPackage,
  item?: ItemCatalogEntry
): PetInstanceState {
  switch (actionType) {
    case CareActionType.FeedMeal:
      if (item !== undefined) {
        return applyFoodItem(state, petPackage, item, false);
      }
      return {
        ...state,
        mood: Mood.Eating,
        careDeadlines: clearCareDeadline(state.careDeadlines, "hunger"),
        stats: {
          ...state.stats,
          hunger: clampStat(state.stats.hunger + 30),
          happiness: clampStat(state.stats.happiness + 4),
          health: clampStat(state.stats.health + 2),
          weight: clampWeight(state.stats.weight + 0.35)
        }
      };
    case CareActionType.FeedSnack:
      if (item !== undefined) {
        return applyFoodItem(state, petPackage, item, true);
      }
      return {
        ...state,
        mood: Mood.Eating,
        careDeadlines: clearCareDeadline(state.careDeadlines, "hunger"),
        stats: {
          ...state.stats,
          hunger: clampStat(state.stats.hunger + 10),
          happiness: clampStat(state.stats.happiness + 16),
          health: clampStat(state.stats.health - 2),
          weight: clampWeight(state.stats.weight + 0.5)
        },
        careHistory: {
          ...state.careHistory,
          snackCount: state.careHistory.snackCount + 1
        }
      };
    case CareActionType.Play:
      return {
        ...state,
        mood: Mood.Playing,
        careDeadlines: clearCareDeadline(state.careDeadlines, "happiness"),
        stats: {
          ...state.stats,
          happiness: clampStat(state.stats.happiness + 18),
          energy: clampStat(state.stats.energy - 8),
          affection: clampStat(
            state.stats.affection + 5 * petPackage.careModifiers.affectionGainMultiplier
          ),
          weight: clampWeight(state.stats.weight - 0.15)
        },
        careHistory: {
          ...state.careHistory,
          playCount: state.careHistory.playCount + 1
        }
      };
    case CareActionType.Clean:
      return {
        ...state,
        messCount: 0,
        careDeadlines: clearCareDeadline(state.careDeadlines, "mess"),
        stats: {
          ...state.stats,
          cleanliness: 100,
          health: clampStat(state.stats.health + 5),
          happiness: clampStat(state.stats.happiness + 2)
        }
      };
    case CareActionType.Medicine:
      return {
        ...state,
        isSick: false,
        careDeadlines: clearCareDeadline(state.careDeadlines, "sickness"),
        stats: {
          ...state.stats,
          health: clampStat(Math.max(55, state.stats.health + 24)),
          happiness: clampStat(state.stats.happiness - 4)
        },
        careHistory: {
          ...state.careHistory,
          medicineDelayHours: 0
        }
      };
    case CareActionType.ToggleSleep: {
      const nextLifecycleStatus =
        state.lifecycleStatus === PetLifecycleStatus.Sleeping
          ? PetLifecycleStatus.Active
          : PetLifecycleStatus.Sleeping;
      return {
        ...state,
        lifecycleStatus: nextLifecycleStatus,
        careDeadlines:
          nextLifecycleStatus === PetLifecycleStatus.Sleeping
            ? clearCareDeadline(state.careDeadlines, "sleep")
            : normalizeCareDeadlines(state.careDeadlines)
      };
    }
    case CareActionType.Pet:
      return {
        ...state,
        careDeadlines: clearCareDeadline(state.careDeadlines, "happiness"),
        stats: {
          ...state.stats,
          happiness: clampStat(state.stats.happiness + 5),
          affection: clampStat(
            state.stats.affection + 4 * petPackage.careModifiers.affectionGainMultiplier
          )
        }
      };
  }
}

function applyFoodItem(
  state: PetInstanceState,
  petPackage: PetPackage,
  item: ItemCatalogEntry,
  isSnack: boolean
): PetInstanceState {
  const itemCategoryMatches =
    (isSnack && item.category === ItemCategory.Snack) ||
    (!isSnack && item.category === ItemCategory.Meal);
  if (!itemCategoryMatches) {
    return state;
  }

  const stats = applyFoodPreferenceModifiers(
    applyItemEffects(state.stats, item),
    petPackage,
    item.id
  );
  const careDeadlines = normalizeCareDeadlines(state.careDeadlines);

  return {
    ...state,
    mood: Mood.Eating,
    stats,
    careDeadlines: {
      ...careDeadlines,
      hunger: stats.hunger >= 20 ? null : careDeadlines.hunger,
      happiness: stats.happiness >= 20 ? null : careDeadlines.happiness
    },
    careHistory: {
      ...state.careHistory,
      snackCount: state.careHistory.snackCount + (isSnack ? 1 : 0)
    }
  };
}

function applyItemEffects(
  stats: PetStats,
  item: ItemCatalogEntry
): PetStats {
  return {
    ...stats,
    hunger: clampStat(stats.hunger + (item.effects.hunger ?? 0)),
    happiness: clampStat(stats.happiness + (item.effects.happiness ?? 0)),
    energy: clampStat(stats.energy + (item.effects.energy ?? 0)),
    cleanliness: clampStat(stats.cleanliness + (item.effects.cleanliness ?? 0)),
    health: clampStat(stats.health + (item.effects.health ?? 0)),
    affection: clampStat(stats.affection + (item.effects.affection ?? 0)),
    discipline: clampStat(stats.discipline + (item.effects.discipline ?? 0)),
    weight: clampWeight(stats.weight + (item.effects.weight ?? 0))
  };
}

function applyGrowth(
  state: PetInstanceState,
  petPackage: PetPackage,
  config: SimulationConfig
): PetInstanceState {
  const targetStage = determineLifeStage(state.ageHours, config);
  const possibleGrowthStages = petPackage.growthStages.filter(
    (growthStage) =>
      growthStage.stage === targetStage &&
      growthStage.careScoreMin <= state.careHistory.qualityScore &&
      growthStage.careScoreMax >= state.careHistory.qualityScore
  );
  const sortedStages = possibleGrowthStages
    .slice()
    .sort((left, right) => right.careScoreMin - left.careScoreMin);
  const selectedStage =
    sortedStages[0] ??
    petPackage.growthStages.find((growthStage) => growthStage.stage === targetStage) ??
    petPackage.growthStages[0];

  return {
    ...state,
    lifeStage: selectedStage.stage,
    growthStageId: selectedStage.id
  };
}

function determineLifeStage(
  ageHours: number,
  config: SimulationConfig
): LifeStage {
  if (ageHours >= config.stageThresholdHours[LifeStage.Adult]) {
    return LifeStage.Adult;
  }
  if (ageHours >= config.stageThresholdHours[LifeStage.Teen]) {
    return LifeStage.Teen;
  }
  if (ageHours >= config.stageThresholdHours[LifeStage.Child]) {
    return LifeStage.Child;
  }
  if (ageHours >= config.stageThresholdHours[LifeStage.Baby]) {
    return LifeStage.Baby;
  }
  return LifeStage.Egg;
}

function nextMessCount(
  currentMessCount: number,
  cleanliness: number,
  config: SimulationConfig
): number {
  if (cleanliness >= 18) {
    return currentMessCount;
  }
  return Math.min(config.maxMessCount, currentMessCount + 1);
}

function nextCareDeadlines(
  currentDeadlines: CareDeadlines,
  stats: PetStats,
  isSick: boolean,
  messCount: number,
  sleeping: boolean,
  now: Date,
  config: SimulationConfig,
  events: SimulationEvent[]
): { deadlines: CareDeadlines; missedCareCount: number } {
  let missedCareCount = 0;
  const nextDeadlines: CareDeadlines = { ...currentDeadlines };
  const rules: Array<{
    key: keyof CareDeadlines;
    active: boolean;
    durationHours: number;
    label: string;
  }> = [
    {
      key: "hunger",
      active: stats.hunger < 20,
      durationHours: config.careDeadlineHours.hunger,
      label: "low hunger"
    },
    {
      key: "happiness",
      active: stats.happiness < 20,
      durationHours: config.careDeadlineHours.happiness,
      label: "low happiness"
    },
    {
      key: "mess",
      active: messCount >= 3,
      durationHours: config.careDeadlineHours.mess,
      label: "mess cleanup"
    },
    {
      key: "sickness",
      active: isSick,
      durationHours: config.careDeadlineHours.sickness,
      label: "medicine"
    },
    {
      key: "sleep",
      active: !sleeping && stats.energy < 15,
      durationHours: config.careDeadlineHours.sleep,
      label: "sleep"
    }
  ];

  for (const rule of rules) {
    const existingDeadline = currentDeadlines[rule.key];
    if (!rule.active) {
      nextDeadlines[rule.key] = null;
      continue;
    }

    if (existingDeadline === null) {
      nextDeadlines[rule.key] = addHours(now, rule.durationHours).toISOString();
      continue;
    }

    if (now.getTime() >= new Date(existingDeadline).getTime()) {
      missedCareCount += 1;
      nextDeadlines[rule.key] = addHours(now, rule.durationHours).toISOString();
      events.push({
        code: "care_deadline_missed",
        message: `Missed ${rule.label} care deadline.`,
        occurredAt: now.toISOString()
      });
    }
  }

  return { deadlines: nextDeadlines, missedCareCount };
}

function nextCareHistory(
  history: CareHistory,
  tickHours: number,
  stats: PetStats,
  isSick: boolean,
  messCount: number,
  lowCare: boolean,
  config: SimulationConfig
): CareHistory {
  const decayWindow = Math.max(1, config.careHistoryWindowHours);
  const historyDecay = Math.max(0, 1 - tickHours / decayWindow);
  const lowHungerHours = history.lowHungerHours * historyDecay + (stats.hunger < 25 ? tickHours : 0);
  const sickHours = history.sickHours * historyDecay + (isSick ? tickHours : 0);
  const messHours = history.messHours * historyDecay + (messCount > 0 ? tickHours : 0);
  const sleepDebtHours =
    history.sleepDebtHours * historyDecay + (stats.energy < 20 ? tickHours : 0);
  const missedCareTicks = history.missedCareTicks + (lowCare ? 1 : 0);
  const medicineDelayHours =
    history.medicineDelayHours * historyDecay + (isSick ? tickHours : 0);
  const qualityScore = clampStat(
    100 -
      lowHungerHours * 1.2 -
      sickHours * 2.2 -
      messHours * 1.4 -
      sleepDebtHours * 0.8 -
      Math.max(0, history.snackCount - history.playCount) * 1.5
  );

  return {
    ...history,
    missedCareTicks,
    sickHours,
    messHours,
    lowHungerHours,
    sleepDebtHours,
    medicineDelayHours,
    careMistakes: history.careMistakes,
    qualityScore
  };
}

function normalizeCareDeadlines(deadlines: CareDeadlines | undefined): CareDeadlines {
  return {
    ...EMPTY_CARE_DEADLINES,
    ...deadlines
  };
}

function clearCareDeadline(
  deadlines: CareDeadlines | undefined,
  key: keyof CareDeadlines
): CareDeadlines {
  return {
    ...normalizeCareDeadlines(deadlines),
    [key]: null
  };
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

function clampStat(value: number): number {
  return Math.min(100, Math.max(0, Number(value.toFixed(3))));
}

function clampWeight(value: number): number {
  return Math.min(999, Math.max(1, Number(value.toFixed(3))));
}
