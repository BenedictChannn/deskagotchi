import { useState } from "react";
import {
  Bath,
  Bone,
  Heart,
  Moon,
  PanelRightOpen,
  Sparkles,
  Stethoscope
} from "lucide-react";

import { CareActionType } from "@shared/domain";
import type { DeskagotchiSnapshot } from "@shared/ipc";
import { PanelView } from "@shared/ipc";

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

  const performAction = async (actionType: CareActionType): Promise<void> => {
    await window.deskagotchi.performAction(actionType);
    setMenuOpen(false);
  };

  return (
    <main className="overlay-window">
      <section className="pet-drag-plane" aria-label="Deskagotchi overlay">
        <PetSprite
          interactive
          snapshot={snapshot}
          size={148}
          onClick={() => setMenuOpen((current) => !current)}
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
            onClick={() => void window.deskagotchi.openPanel(PanelView.Status)}
          >
            <Stethoscope size={17} />
          </ActionButton>
          <ActionButton
            label="More"
            onClick={() => void window.deskagotchi.openPanel(PanelView.PetSelector)}
          >
            <PanelRightOpen size={17} />
          </ActionButton>
        </nav>
      ) : null}

      <div className="overlay-mood" aria-hidden="true">
        <Heart size={12} />
        <span>{snapshot.activeState.mood}</span>
      </div>
    </main>
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
