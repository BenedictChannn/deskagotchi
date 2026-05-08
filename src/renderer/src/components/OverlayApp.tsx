import { useCallback, useEffect, useRef, useState } from "react";

import { CareActionType, PetLifecycleStatus } from "@shared/domain";
import { ItemCategory, type ItemCatalogEntry } from "@shared/itemIcons";
import type { DeskagotchiSnapshot } from "@shared/ipc";

import { lcdItemIconSet } from "../itemIconAssets";
import { ItemIcon } from "./ItemIcon";
import { PetSprite } from "./PetSprite";
import { PlayStage } from "./PlayStage";

/** Props for the always-on-desktop pet overlay. */
interface OverlayAppProps {
  /** Current simulation snapshot used to render pet state and actions. */
  snapshot: DeskagotchiSnapshot;
}

/**
 * Render the compact overlay pet and its quick action radial menu.
 *
 * @param props - Overlay snapshot and action state.
 * @returns The desktop overlay renderer view.
 */
export function OverlayApp({ snapshot }: OverlayAppProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [playActive, setPlayActive] = useState(false);
  const [careFlow, setCareFlow] = useState<"medicine" | "clean" | "sleep" | null>(
    null
  );
  const [feedCategory, setFeedCategory] = useState<ItemCategory.Meal | ItemCategory.Snack>(
    ItemCategory.Meal
  );
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

  const performAction = async (
    actionType: CareActionType,
    itemId?: string
  ): Promise<void> => {
    await window.deskagotchi.performAction({ type: actionType, itemId });
    setMenuOpen(false);
    setHealthOpen(false);
    setFeedOpen(false);
    setPlayOpen(false);
    setCareFlow(null);
  };

  const recordQaEvent = (
    event: string,
    payload: Record<string, unknown> = {}
  ): void => {
    void window.deskagotchi.recordQaEvent({
      event,
      source: "renderer",
      windowRole: playActive ? "play-overlay" : "overlay",
      payload
    });
  };

  const closePlay = useCallback((): void => {
    setPlayActive(false);
    void window.deskagotchi
      .exitPetWindowPlayMode()
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (
      !menuOpen &&
      !healthOpen &&
      !feedOpen &&
      !playOpen &&
      !playActive &&
      careFlow === null
    ) {
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
      setMenuOpen(false);
      setHealthOpen(false);
      setFeedOpen(false);
      setPlayOpen(false);
      setCareFlow(null);
    };

    window.addEventListener("keydown", closeTransientUi);
    return () => window.removeEventListener("keydown", closeTransientUi);
  }, [careFlow, closePlay, feedOpen, healthOpen, menuOpen, playActive, playOpen]);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }

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
      setMenuOpen(false);
      setHealthOpen(false);
      setFeedOpen(false);
      setPlayOpen(false);
      setPlayActive(false);
      setCareFlow(null);
    }
    void window.deskagotchi.movePetWindow(windowDeltaX, windowDeltaY);
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
      menuOpen
    });
    dragState.current = undefined;
    void window.deskagotchi.finishPetWindowDrag();
  };

  const toggleMenu = (): void => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }

    setMenuOpen((current) => {
      if (!current) {
        setHealthOpen(false);
        setFeedOpen(false);
        setPlayOpen(false);
        setCareFlow(null);
        recordQaEvent("menu:open", {
          reason: "pet-click",
          duringDrag: false
        });
      }
      return !current;
    });
  };

  const openFeed = (): void => {
    setMenuOpen(false);
    setHealthOpen(false);
    setPlayOpen(false);
    setPlayActive(false);
    setCareFlow(null);
    recordQaEvent("overlay:feed-open");
    setFeedOpen(true);
  };

  const openPlay = (): void => {
    setMenuOpen(false);
    setHealthOpen(false);
    setFeedOpen(false);
    setCareFlow(null);
    recordQaEvent("overlay:play-open");
    setPlayOpen(true);
  };

  const startPlay = (): void => {
    setMenuOpen(false);
    setHealthOpen(false);
    setFeedOpen(false);
    setPlayOpen(false);
    setCareFlow(null);
    recordQaEvent("play:enter");
    void window.deskagotchi
      .enterPetWindowPlayMode()
      .then(() => setPlayActive(true))
      .catch(() => setPlayActive(false));
  };

  const rewardPlay = useCallback(async (): Promise<void> => {
    await window.deskagotchi.performAction({ type: CareActionType.Play });
  }, []);

  const toggleHealth = (): void => {
    setMenuOpen(false);
    setFeedOpen(false);
    setPlayOpen(false);
    setCareFlow(null);
    recordQaEvent("overlay:health-open", {
      nextOpen: !healthOpen
    });
    setHealthOpen((current) => !current);
  };

  const openCareFlow = (flow: "medicine" | "clean" | "sleep"): void => {
    setMenuOpen(false);
    setHealthOpen(false);
    setFeedOpen(false);
    setPlayOpen(false);
    recordQaEvent("overlay:care-flow-open", {
      flow
    });
    setCareFlow(flow);
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
          className="pet-drag-plane"
          aria-label="Deskagotchi overlay"
          data-testid="pet-drag-plane"
        >
          <PetSprite
            interactive
            snapshot={snapshot}
            size={148}
            onClick={toggleMenu}
            onPointerDown={startDrag}
          />
        </section>
      )}
      {!playActive && snapshot.activeState.messCount > 0 ? (
        <MessMarkers count={snapshot.activeState.messCount} />
      ) : null}

      {menuOpen ? (
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

      {healthOpen ? <OverlayHealthCard snapshot={snapshot} /> : null}
      {feedOpen ? (
        <FeedPicker
          activeCategory={feedCategory}
          onCategoryChange={setFeedCategory}
          onSelect={(item) => {
            const actionType =
              item.category === ItemCategory.Snack
                ? CareActionType.FeedSnack
                : CareActionType.FeedMeal;
            void performAction(actionType, item.id);
          }}
        />
      ) : null}
      {playOpen ? <PlayPicker onStart={startPlay} /> : null}
      {careFlow !== null ? (
        <CareFlowCard
          flow={careFlow}
          snapshot={snapshot}
          onCancel={() => setCareFlow(null)}
          onConfirm={(actionType) => void performAction(actionType)}
        />
      ) : null}

      {!playActive ? (
        <div className="overlay-mood" aria-hidden="true">
          <ItemIcon iconId="heart" size={14} />
          <span>{snapshot.activeState.mood}</span>
        </div>
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
  flow: "medicine" | "clean" | "sleep";
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
  flow: "medicine" | "clean" | "sleep",
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
  onStart
}: {
  onStart: () => void;
}): React.JSX.Element {
  return (
    <section className="overlay-play-picker" aria-label="Play options">
      <button className="overlay-play-option" type="button" onClick={onStart}>
        <ItemIcon iconId="ball" size={22} />
        <span>Ball</span>
      </button>
    </section>
  );
}

function FeedPicker({
  activeCategory,
  onCategoryChange,
  onSelect
}: {
  activeCategory: ItemCategory.Meal | ItemCategory.Snack;
  onCategoryChange: (category: ItemCategory.Meal | ItemCategory.Snack) => void;
  onSelect: (item: ItemCatalogEntry) => void;
}): React.JSX.Element {
  const feedItems = lcdItemIconSet.manifest.items.filter(
    (item) => item.category === activeCategory
  );

  return (
    <section className="overlay-feed-picker" aria-label="Feed pet">
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
      <div className="overlay-feed-list">
        {feedItems.map((item) => (
          <button
            key={item.id}
            className="overlay-feed-item"
            type="button"
            onClick={() => onSelect(item)}
            title={describeEffects(item)}
          >
            <ItemIcon iconId={item.iconId} size={20} />
            <span>{item.label}</span>
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

function describeEffects(item: ItemCatalogEntry): string {
  const effectLabels = Object.entries(item.effects).map(([stat, value]) =>
    `${stat} ${value > 0 ? "+" : ""}${value}`
  );
  return effectLabels.join(", ");
}

function OverlayHealthCard({
  snapshot
}: {
  snapshot: DeskagotchiSnapshot;
}): React.JSX.Element {
  const stats = snapshot.activeState.stats;
  return (
    <section
      className="overlay-health-card"
      aria-label="Pet health"
      data-testid="overlay-health-card"
    >
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
    <button className="overlay-action-button" type="button" onClick={onClick} title={label}>
      {children}
      <span>{label}</span>
    </button>
  );
}
