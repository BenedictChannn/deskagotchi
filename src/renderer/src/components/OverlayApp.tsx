import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CareActionType, Mood, PetLifecycleStatus } from "@shared/domain";
import {
  FoodPreferenceKind,
  feedItemsForPet,
  foodPreferenceForPet
} from "@shared/food";
import { ItemCategory, type ItemCatalogEntry } from "@shared/itemIcons";
import { PetWindowUiMode, type DeskagotchiSnapshot } from "@shared/ipc";

import { lcdItemIconSet } from "../itemIconAssets";
import { ItemIcon } from "./ItemIcon";
import { PetSprite } from "./PetSprite";
import { PlayStage } from "./PlayStage";

const DRAG_CLICK_SUPPRESSION_MS = 500;

/** Props for the always-on-desktop pet overlay. */
interface OverlayAppProps {
  /** Current simulation snapshot used to render pet state and actions. */
  snapshot: DeskagotchiSnapshot;
}

type CareFlow = "medicine" | "clean" | "sleep";

type OverlayMode =
  | { kind: "compact" }
  | { kind: "menu" }
  | { kind: "health" }
  | { kind: "feed" }
  | { kind: "play-picker" }
  | { kind: "play-active" }
  | { kind: "care"; flow: CareFlow };

/**
 * Render the compact overlay pet and its quick action radial menu.
 *
 * @param props - Overlay snapshot and action state.
 * @returns The desktop overlay renderer view.
 */
export function OverlayApp({ snapshot }: OverlayAppProps): React.JSX.Element {
  const [mode, setMode] = useState<OverlayMode>({ kind: "compact" });
  const [feedCategory, setFeedCategory] = useState<ItemCategory.Meal | ItemCategory.Snack>(
    ItemCategory.Meal
  );
  const [eatingCueItem, setEatingCueItem] = useState<ItemCatalogEntry | undefined>();
  const [petHovering, setPetHovering] = useState(false);
  const hasTrayOverlay = mode.kind === "menu" || mode.kind === "play-picker";
  const hasCardOverlay =
    mode.kind === "health" || mode.kind === "feed" || mode.kind === "care";
  const playActive = mode.kind === "play-active";
  const petSpriteSize = 148;
  const petDragPlaneClassName = [
    "pet-drag-plane",
    hasTrayOverlay ? "pet-drag-plane--tray-open" : "",
    hasCardOverlay ? "pet-drag-plane--card-open" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const dragState = useRef<{
    pointerId: number;
    target: HTMLButtonElement;
    originScreenX: number;
    originScreenY: number;
    lastScreenX: number;
    lastScreenY: number;
    totalDelta: number;
  }>();
  const suppressNextClick = useRef(false);
  const suppressClicksUntil = useRef(0);
  const eatingCueTimeout = useRef<number | undefined>();
  const activeEatingItem =
    snapshot.activeState.mood === Mood.Eating ? eatingCueItem : undefined;

  const performAction = async (
    actionType: CareActionType,
    itemId?: string
  ): Promise<void> => {
    await window.deskagotchi.performAction({ type: actionType, itemId });
    setMode({ kind: "compact" });
  };

  const recordQaEvent = useCallback(
    (event: string, payload: Record<string, unknown> = {}): void => {
      void window.deskagotchi.recordQaEvent({
        event,
        source: "renderer",
        windowRole: playActive ? "play-overlay" : "overlay",
        payload
      });
    },
    [playActive]
  );

  const closePlay = useCallback((): void => {
    setMode({ kind: "compact" });
    void window.deskagotchi
      .exitPetWindowPlayMode()
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      if (eatingCueTimeout.current !== undefined) {
        window.clearTimeout(eatingCueTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode.kind === "compact") {
      return undefined;
    }

    const closeTransientUi = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      if (playActive) {
        closePlay();
        return;
      }
      setMode({ kind: "compact" });
    };

    window.addEventListener("keydown", closeTransientUi);
    return () => window.removeEventListener("keydown", closeTransientUi);
  }, [closePlay, mode.kind, playActive]);

  useEffect(() => {
    if (playActive) {
      return undefined;
    }

    const mode = hasCardOverlay
      ? PetWindowUiMode.Card
      : hasTrayOverlay
        ? PetWindowUiMode.Tray
        : PetWindowUiMode.Compact;
    void window.deskagotchi.setPetWindowUiMode(mode);
    return undefined;
  }, [hasCardOverlay, hasTrayOverlay, playActive]);

  useEffect(() => {
    const clickThroughEnabled =
      snapshot.save.settings.clickThroughWhenIdle &&
      mode.kind === "compact" &&
      !petHovering &&
      !playActive;
    void window.deskagotchi
      .setClickThrough(clickThroughEnabled)
      .then(() =>
        recordQaEvent("overlay:click-through-request", {
          enabled: clickThroughEnabled,
          mode: mode.kind,
          petHovering
        })
      )
      .catch(() => undefined);
    return undefined;
  }, [
    mode.kind,
    petHovering,
    playActive,
    recordQaEvent,
    snapshot.save.settings.clickThroughWhenIdle
  ]);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }

    setPetHovering(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    recordQaEvent("drag:start", {
      pointer: {
        x: event.screenX,
        y: event.screenY
      }
    });
    dragState.current = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      originScreenX: event.screenX,
      originScreenY: event.screenY,
      lastScreenX: event.screenX,
      lastScreenY: event.screenY,
      totalDelta: 0
    };
    event.currentTarget.addEventListener("pointermove", moveDrag);
    event.currentTarget.addEventListener("pointerup", finishDrag);
    event.currentTarget.addEventListener("pointercancel", finishDrag);
  };

  const moveDrag = (event: PointerEvent): void => {
    const currentDrag = dragState.current;
    if (currentDrag === undefined || event.pointerId !== currentDrag.pointerId) {
      return;
    }

    const deltaX = event.screenX - currentDrag.lastScreenX;
    const deltaY = event.screenY - currentDrag.lastScreenY;
    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    currentDrag.lastScreenX = event.screenX;
    currentDrag.lastScreenY = event.screenY;
    currentDrag.totalDelta += Math.abs(deltaX) + Math.abs(deltaY);
    const scaleFactor = window.devicePixelRatio || 1;
    const windowDeltaX = deltaX / scaleFactor;
    const windowDeltaY = deltaY / scaleFactor;
    recordQaEvent("drag:move", {
      delta: {
        x: deltaX,
        y: deltaY
      },
      windowDelta: {
        x: windowDeltaX,
        y: windowDeltaY
      },
      pointer: {
        x: event.screenX,
        y: event.screenY
      }
    });
    if (currentDrag.totalDelta > 4) {
      suppressNextClick.current = true;
      suppressClicksUntil.current =
        window.performance.now() + DRAG_CLICK_SUPPRESSION_MS;
    }
    void window.deskagotchi.movePetWindow(windowDeltaX, windowDeltaY, {
      x: event.screenX,
      y: event.screenY
    });
  };

  const finishDrag = (event: PointerEvent): void => {
    const currentDrag = dragState.current;
    if (currentDrag === undefined || event.pointerId !== currentDrag.pointerId) {
      return;
    }

    currentDrag.target.removeEventListener("pointermove", moveDrag);
    currentDrag.target.removeEventListener("pointerup", finishDrag);
    currentDrag.target.removeEventListener("pointercancel", finishDrag);
    if (currentDrag.target.hasPointerCapture(event.pointerId)) {
      currentDrag.target.releasePointerCapture(event.pointerId);
    }
    recordQaEvent("drag:end", {
      totalDelta: {
        x: event.screenX - currentDrag.originScreenX,
        y: event.screenY - currentDrag.originScreenY,
        absolute: currentDrag.totalDelta
      },
      menuOpen: mode.kind === "menu"
    });
    if (currentDrag.totalDelta > 4) {
      suppressNextClick.current = true;
      suppressClicksUntil.current =
        window.performance.now() + DRAG_CLICK_SUPPRESSION_MS;
      setMode({ kind: "compact" });
    }
    dragState.current = undefined;
    setPetHovering(currentDrag.target.matches(":hover"));
    void window.deskagotchi.finishPetWindowDrag();
  };

  const toggleMenu = (): void => {
    if (
      suppressNextClick.current ||
      window.performance.now() < suppressClicksUntil.current
    ) {
      suppressNextClick.current = false;
      return;
    }

    if (mode.kind !== "menu") {
      recordQaEvent("menu:open", {
        reason: "pet-click",
        duringDrag: false
      });
      setMode({ kind: "menu" });
      return;
    }
    setMode({ kind: "compact" });
  };

  const enterPetHitArea = (): void => {
    setPetHovering(true);
  };

  const leavePetHitArea = (): void => {
    if (dragState.current === undefined) {
      setPetHovering(false);
    }
  };

  const openFeed = (): void => {
    recordQaEvent("overlay:feed-open");
    setMode({ kind: "feed" });
  };

  const openPlay = (): void => {
    recordQaEvent("overlay:play-open");
    setMode({ kind: "play-picker" });
  };

  const startPlay = (): void => {
    recordQaEvent("play:enter");
    setMode({ kind: "compact" });
    void window.deskagotchi
      .enterPetWindowPlayMode()
      .then(() => setMode({ kind: "play-active" }))
      .catch(() => setMode({ kind: "compact" }));
  };

  const rewardPlay = useCallback(async (): Promise<void> => {
    await window.deskagotchi.performAction({ type: CareActionType.Play });
  }, []);

  const toggleHealth = (): void => {
    recordQaEvent("overlay:health-open", {
      nextOpen: mode.kind !== "health"
    });
    setMode(mode.kind === "health" ? { kind: "compact" } : { kind: "health" });
  };

  const openCareFlow = (flow: CareFlow): void => {
    recordQaEvent("overlay:care-flow-open", {
      flow
    });
    setMode({ kind: "care", flow });
  };

  return (
    <main className="overlay-window" data-testid="overlay-window">
      {playActive ? (
        <PlayStage
          snapshot={snapshot}
          onReward={() => void rewardPlay()}
          onClose={closePlay}
        />
      ) : (
        <section
          className={petDragPlaneClassName}
          aria-label="Deskagotchi overlay"
          data-testid="pet-drag-plane"
        >
          <PetSprite
            eatingItem={activeEatingItem}
            interactive
            snapshot={snapshot}
            size={petSpriteSize}
            onClick={toggleMenu}
            onPointerDown={startDrag}
            onPointerEnter={enterPetHitArea}
            onPointerLeave={leavePetHitArea}
          />
        </section>
      )}
      {!playActive && snapshot.activeState.messCount > 0 ? (
        <MessMarkers count={snapshot.activeState.messCount} />
      ) : null}

      {mode.kind === "menu" ? (
        <nav
          className="overlay-actions"
          aria-label="Pet actions"
          data-testid="overlay-actions"
        >
          <ActionButton
            label="Feed"
            onClick={openFeed}
          >
            <ItemIcon iconId="bowl" />
          </ActionButton>
          <ActionButton
            label="Play"
            onClick={openPlay}
          >
            <ItemIcon iconId="ball" />
          </ActionButton>
          <ActionButton
            label="Clean"
            onClick={() => openCareFlow("clean")}
          >
            <ItemIcon iconId="sponge" />
          </ActionButton>
          <ActionButton
            label="Sleep"
            onClick={() => openCareFlow("sleep")}
          >
            <ItemIcon iconId="crescent" />
          </ActionButton>
          <ActionButton
            label="Med"
            onClick={() => openCareFlow("medicine")}
          >
            <ItemIcon iconId="capsule" />
          </ActionButton>
          <ActionButton
            label="Health"
            onClick={toggleHealth}
          >
            <ItemIcon iconId="meter" />
          </ActionButton>
        </nav>
      ) : null}

      {mode.kind === "health" ? (
        <OverlayHealthCard
          snapshot={snapshot}
          onClose={() => setMode({ kind: "compact" })}
        />
      ) : null}
      {mode.kind === "feed" ? (
        <FeedPicker
          activeCategory={feedCategory}
          petPackage={snapshot.activePackage.petPackage}
          onCategoryChange={setFeedCategory}
          onCancel={() => setMode({ kind: "compact" })}
          onSelect={(item) => {
            setEatingCueItem(item);
            if (eatingCueTimeout.current !== undefined) {
              window.clearTimeout(eatingCueTimeout.current);
            }
            eatingCueTimeout.current = window.setTimeout(() => {
              setEatingCueItem(undefined);
            }, 2_800);
            const actionType =
              item.category === ItemCategory.Snack
                ? CareActionType.FeedSnack
                : CareActionType.FeedMeal;
            void performAction(actionType, item.id);
          }}
        />
      ) : null}
      {mode.kind === "play-picker" ? (
        <PlayPicker
          onCancel={() => setMode({ kind: "compact" })}
          onStart={startPlay}
        />
      ) : null}
      {mode.kind === "care" ? (
        <CareFlowCard
          flow={mode.flow}
          snapshot={snapshot}
          onCancel={() => setMode({ kind: "compact" })}
          onConfirm={(actionType) => void performAction(actionType)}
        />
      ) : null}
    </main>
  );
}

function MessMarkers({ count }: { count: number }): React.JSX.Element {
  const markers = Array.from({ length: Math.min(3, count) }, (_, index) => index);
  return (
    <div className="overlay-mess-markers" aria-hidden="true">
      {markers.map((marker) => (
        <ItemIcon key={marker} iconId="mess" size={18} />
      ))}
    </div>
  );
}

function CareFlowCard({
  flow,
  snapshot,
  onCancel,
  onConfirm
}: {
  flow: CareFlow;
  snapshot: DeskagotchiSnapshot;
  onCancel: () => void;
  onConfirm: (actionType: CareActionType) => void;
}): React.JSX.Element {
  const state = snapshot.activeState;
  const isSleeping = state.lifecycleStatus === PetLifecycleStatus.Sleeping;
  const flowConfig = getCareFlowConfig(flow, snapshot);
  const actionType = flowConfig.actionType;

  return (
    <section className="overlay-care-flow" aria-label={flowConfig.label}>
      <div className="overlay-care-flow-header">
        <ItemIcon iconId={flowConfig.iconId} size={22} />
        <span>{flowConfig.label}</span>
      </div>
      <p>{flowConfig.message}</p>
      <div className="overlay-care-flow-actions">
        <button type="button" onClick={onCancel}>
          X
        </button>
        {actionType !== undefined ? (
          <button
            type="button"
            onClick={() => onConfirm(actionType)}
          >
            {isSleeping && flow === "sleep" ? "Wake" : flowConfig.actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function getCareFlowConfig(
  flow: CareFlow,
  snapshot: DeskagotchiSnapshot
): {
  label: string;
  iconId: string;
  message: string;
  actionLabel: string;
  actionType?: CareActionType;
} {
  const state = snapshot.activeState;
  if (flow === "medicine") {
    const needsMedicine = state.isSick || state.stats.health < 55;
    return {
      label: "Medicine",
      iconId: needsMedicine ? "capsule" : "face",
      message: needsMedicine ? "Needs care" : "Looks OK",
      actionLabel: "Use",
      actionType: needsMedicine ? CareActionType.Medicine : undefined
    };
  }

  if (flow === "clean") {
    const needsCleaning = state.messCount > 0 || state.stats.cleanliness < 92;
    return {
      label: "Clean",
      iconId: needsCleaning ? "sponge" : "sparkle",
      message: needsCleaning ? "Clean up" : "Already clean",
      actionLabel: "Clean",
      actionType: needsCleaning ? CareActionType.Clean : undefined
    };
  }

  return {
    label: "Lights",
    iconId: state.lifecycleStatus === PetLifecycleStatus.Sleeping ? "lamp" : "crescent",
    message: state.lifecycleStatus === PetLifecycleStatus.Sleeping ? "Sleeping" : "Rest now",
    actionLabel: "Sleep",
    actionType: CareActionType.ToggleSleep
  };
}

function PlayPicker({
  onCancel,
  onStart
}: {
  onCancel: () => void;
  onStart: () => void;
}): React.JSX.Element {
  return (
    <section className="overlay-play-picker" aria-label="Play options">
      <button
        className="overlay-popover-close"
        type="button"
        aria-label="Close play menu"
        onClick={onCancel}
      >
        X
      </button>
      <button className="overlay-play-option" type="button" onClick={onStart}>
        <ItemIcon iconId="ball" size={22} />
        <span>Ball</span>
      </button>
    </section>
  );
}

function FeedPicker({
  activeCategory,
  petPackage,
  onCategoryChange,
  onCancel,
  onSelect
}: {
  activeCategory: ItemCategory.Meal | ItemCategory.Snack;
  petPackage: DeskagotchiSnapshot["activePackage"]["petPackage"];
  onCategoryChange: (category: ItemCategory.Meal | ItemCategory.Snack) => void;
  onCancel: () => void;
  onSelect: (item: ItemCatalogEntry) => void;
}): React.JSX.Element {
  const feedItems = useMemo(
    () => feedItemsForPet(lcdItemIconSet.manifest.items, petPackage, activeCategory),
    [activeCategory, petPackage]
  );

  return (
    <section
      className="overlay-feed-picker"
      aria-label="Feed pet"
      data-testid="overlay-feed-picker"
    >
      <div className="overlay-popover-header">
        <div className="overlay-feed-tabs" role="tablist" aria-label="Feed category">
          <FeedTab
            active={activeCategory === ItemCategory.Meal}
            label="Meal"
            onClick={() => onCategoryChange(ItemCategory.Meal)}
          />
          <FeedTab
            active={activeCategory === ItemCategory.Snack}
            label="Snack"
            onClick={() => onCategoryChange(ItemCategory.Snack)}
          />
        </div>
        <button
          className="overlay-popover-close"
          type="button"
          aria-label="Close feed menu"
          onClick={onCancel}
        >
          X
        </button>
      </div>
      <div className="overlay-feed-list">
        {feedItems.map((item) => (
          <button
            key={item.id}
            className={feedItemClassName(foodPreferenceForPet(petPackage, item.id))}
            type="button"
            data-testid="overlay-feed-item"
            data-icon-id={item.iconId}
            data-item-id={item.id}
            onClick={() => onSelect(item)}
            title={describeFoodItem(item)}
          >
            <ItemIcon iconId={item.iconId} size={20} />
            <span className="overlay-feed-name">{item.label}</span>
            <PreferenceMarker preference={foodPreferenceForPet(petPackage, item.id)} />
          </button>
        ))}
      </div>
    </section>
  );
}

function FeedTab({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      className={active ? "overlay-feed-tab overlay-feed-tab--active" : "overlay-feed-tab"}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function describeFoodItem(item: ItemCatalogEntry): string {
  const effectLabels = Object.entries(item.effects).map(([stat, value]) =>
    `${stat} ${value > 0 ? "+" : ""}${value}`
  );
  return effectLabels.join(", ");
}

function feedItemClassName(preference: FoodPreferenceKind): string {
  const modifier =
    preference === FoodPreferenceKind.Favorite
      ? "overlay-feed-item--favorite"
      : preference === FoodPreferenceKind.Liked
        ? "overlay-feed-item--liked"
        : "";

  return ["overlay-feed-item", modifier].filter(Boolean).join(" ");
}

function PreferenceMarker({
  preference
}: {
  preference: FoodPreferenceKind;
}): React.JSX.Element | null {
  if (preference === FoodPreferenceKind.Favorite) {
    return (
      <span className="overlay-feed-marker" aria-hidden="true">
        <ItemIcon iconId="heart" size={9} />
      </span>
    );
  }

  if (preference === FoodPreferenceKind.Liked) {
    return <span className="overlay-feed-marker overlay-feed-marker--dot" aria-hidden="true" />;
  }

  return null;
}

function OverlayHealthCard({
  snapshot,
  onClose
}: {
  snapshot: DeskagotchiSnapshot;
  onClose: () => void;
}): React.JSX.Element {
  const stats = snapshot.activeState.stats;
  return (
    <section
      className="overlay-health-card"
      aria-label="Pet health"
      data-testid="overlay-health-card"
    >
      <div className="overlay-popover-header">
        <span className="overlay-popover-title">Status</span>
        <button
          className="overlay-popover-close"
          type="button"
          aria-label="Close health panel"
          onClick={onClose}
        >
          X
        </button>
      </div>
      <HealthStat label="Hunger" value={stats.hunger} />
      <HealthStat label="Happy" value={stats.happiness} />
      <HealthStat label="Energy" value={stats.energy} />
      <HealthStat label="Clean" value={stats.cleanliness} />
      <HealthStat label="Health" value={stats.health} />
    </section>
  );
}

function HealthStat({
  label,
  value
}: {
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className="overlay-health-stat">
      <span>{label}</span>
      <meter min={0} max={100} value={Math.round(value)} />
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}

function ActionButton({
  label,
  children,
  onClick
}: ActionButtonProps): React.JSX.Element {
  return (
    <button
      className="overlay-action-button"
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      data-action-label={label}
    >
      {children}
      <span className="overlay-action-label">{label}</span>
    </button>
  );
}
