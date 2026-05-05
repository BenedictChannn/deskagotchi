import {
  AnimationId,
  CareActionType,
  type CareHistory,
  CURRENT_SIMULATION_CONFIG_VERSION,
  LifeStage,
  Mood,
  type PetInstanceState,
  type PetPackage,
  type PetStats,
  PetLifecycleStatus
} from "./domain";

export interface SimulationConfig {
  version: typeof CURRENT_SIMULATION_CONFIG_VERSION;
  tickMinutes: number;
  maxOfflineCatchupHours: number;
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
  stageThresholdHours: Record<LifeStage, number>;
}

export interface SimulationEvent {
  code: string;
  message: string;
  occurredAt: string;
}

export interface CareAction {
  type: CareActionType;
  now: Date;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  version: CURRENT_SIMULATION_CONFIG_VERSION,
  tickMinutes: 15,
  maxOfflineCatchupHours: 36,
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
  stageThresholdHours: {
    [LifeStage.Egg]: 0,
    [LifeStage.Baby]: 2,
    [LifeStage.Child]: 8,
    [LifeStage.Teen]: 30,
    [LifeStage.Adult]: 72
  }
};

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
    offlineDebtHours: state.offlineDebtHours + offlineDebtHours
  };

  for (let tick = 0; tick < fullTicks; tick += 1) {
    progressedState = applySimulationTick(
      progressedState,
      petPackage,
      tickHours,
      config,
      now,
      events
    );
  }

  if (remainderHours > 0) {
    progressedState = applySimulationTick(
      progressedState,
      petPackage,
      remainderHours,
      config,
      now,
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
  const mood = deriveMood(growthState);

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

export function applyCareAction(
  state: PetInstanceState,
  petPackage: PetPackage,
  action: CareAction,
  config = DEFAULT_SIMULATION_CONFIG
): { state: PetInstanceState; events: SimulationEvent[] } {
  const progressed = progressPetState(state, petPackage, action.now, config);
  const nextState = applyActionEffects(progressed.state, action.type, petPackage);

  return {
    state: {
      ...nextState,
      mood: deriveMood(nextState),
      updatedAt: action.now.toISOString(),
      lastSimulatedAt: action.now.toISOString()
    },
    events: progressed.events
  };
}

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

  return Mood.Idle;
}

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
      return AnimationId.Cleaning;
    case Mood.Attention:
      return AnimationId.Attention;
    case Mood.Idle:
      return AnimationId.Idle;
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
  const careHistory = nextCareHistory(
    state.careHistory,
    tickHours,
    stats,
    isSick,
    messCount,
    lowCare,
    config
  );

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
    careHistory
  };
}

function applyActionEffects(
  state: PetInstanceState,
  actionType: CareActionType,
  petPackage: PetPackage
): PetInstanceState {
  switch (actionType) {
    case CareActionType.FeedMeal:
      return {
        ...state,
        mood: Mood.Eating,
        stats: {
          ...state.stats,
          hunger: clampStat(state.stats.hunger + 30),
          happiness: clampStat(state.stats.happiness + 4),
          health: clampStat(state.stats.health + 2),
          weight: clampWeight(state.stats.weight + 0.35)
        }
      };
    case CareActionType.FeedSnack:
      return {
        ...state,
        mood: Mood.Eating,
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
    case CareActionType.ToggleSleep:
      return {
        ...state,
        lifecycleStatus:
          state.lifecycleStatus === PetLifecycleStatus.Sleeping
            ? PetLifecycleStatus.Active
            : PetLifecycleStatus.Sleeping
      };
    case CareActionType.Pet:
      return {
        ...state,
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
  const careMistakes = history.careMistakes + (lowCare ? 1 : 0);
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
    careMistakes,
    qualityScore
  };
}

function clampStat(value: number): number {
  return Math.min(100, Math.max(0, Number(value.toFixed(3))));
}

function clampWeight(value: number): number {
  return Math.min(999, Math.max(1, Number(value.toFixed(3))));
}
