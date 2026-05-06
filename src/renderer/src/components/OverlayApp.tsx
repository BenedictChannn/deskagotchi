import { useEffect, useRef, useState } from "react";
import {
  Bath,
  Bone,
  Heart,
  Moon,
  Sparkles,
  Stethoscope
} from "lucide-react";

import { CareActionType } from "@shared/domain";
import type { DeskagotchiSnapshot } from "@shared/ipc";

import { PetSprite } from "./PetSprite";

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
  const dragState = useRef<{
    pointerId: number;
    target: HTMLButtonElement;
    lastScreenX: number;
    lastScreenY: number;
    totalDelta: number;
  }>();
  const suppressNextClick = useRef(false);

  const performAction = async (actionType: CareActionType): Promise<void> => {
    await window.deskagotchi.performAction(actionType);
    setMenuOpen(false);
    setHealthOpen(false);
  };

  useEffect(() => {
    if (!menuOpen && !healthOpen) {
      return undefined;
    }

    const closeTransientUi = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      setMenuOpen(false);
      setHealthOpen(false);
    };

    window.addEventListener("keydown", closeTransientUi);
    return () => window.removeEventListener("keydown", closeTransientUi);
  }, [healthOpen, menuOpen]);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      lastScreenX: event.screenX,
      lastScreenY: event.screenY,
      totalDelta: 0
    };
    window.addEventListener("pointermove", moveDrag);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
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
    if (currentDrag.totalDelta > 4) {
      suppressNextClick.current = true;
      setMenuOpen(false);
      setHealthOpen(false);
    }
    void window.deskagotchi.movePetWindow(deltaX, deltaY);
  };

  const finishDrag = (event: PointerEvent): void => {
    const currentDrag = dragState.current;
    if (currentDrag === undefined || event.pointerId !== currentDrag.pointerId) {
      return;
    }

    window.removeEventListener("pointermove", moveDrag);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
    if (currentDrag.target.hasPointerCapture(event.pointerId)) {
      currentDrag.target.releasePointerCapture(event.pointerId);
    }
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
      }
      return !current;
    });
  };

  const toggleHealth = (): void => {
    setMenuOpen(false);
    setHealthOpen((current) => !current);
  };

  return (
    <main className="overlay-window">
      <section className="pet-drag-plane" aria-label="Deskagotchi overlay">
        <PetSprite
          interactive
          snapshot={snapshot}
          size={148}
          onClick={toggleMenu}
          onPointerDown={startDrag}
        />
      </section>

      {menuOpen ? (
        <nav className="overlay-actions" aria-label="Pet actions">
          <ActionButton
            label="Meal"
            onClick={() => void performAction(CareActionType.FeedMeal)}
          >
            <Bone size={17} />
          </ActionButton>
          <ActionButton
            label="Play"
            onClick={() => void performAction(CareActionType.Play)}
          >
            <Sparkles size={17} />
          </ActionButton>
          <ActionButton
            label="Clean"
            onClick={() => void performAction(CareActionType.Clean)}
          >
            <Bath size={17} />
          </ActionButton>
          <ActionButton
            label="Sleep"
            onClick={() => void performAction(CareActionType.ToggleSleep)}
          >
            <Moon size={17} />
          </ActionButton>
          <ActionButton
            label="Health"
            onClick={toggleHealth}
          >
            <Stethoscope size={17} />
          </ActionButton>
        </nav>
      ) : null}

      {healthOpen ? <OverlayHealthCard snapshot={snapshot} /> : null}

      <div className="overlay-mood" aria-hidden="true">
        <Heart size={12} />
        <span>{snapshot.activeState.mood}</span>
      </div>
    </main>
  );
}

function OverlayHealthCard({
  snapshot
}: {
  snapshot: DeskagotchiSnapshot;
}): React.JSX.Element {
  const stats = snapshot.activeState.stats;
  return (
    <section className="overlay-health-card" aria-label="Pet health">
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
